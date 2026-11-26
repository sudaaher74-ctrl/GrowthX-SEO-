"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { feature, mesh as topoMesh } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";
import { ISO_NUMERIC_TO_CODE } from "@/lib/geo-coordinates";
import { count, percent } from "@/lib/google-format";
import { cn } from "@/lib/utils";

export interface GlobePin {
  id: string;
  label: string;
  sublabel?: string;
  flag: string;
  code: string;
  lat: number;
  lng: number;
  visitors: number;
  share: number;
  metricUnit?: string;
  liveUsers?: number;
  botHubReason?: string | null;
  isTargetGap?: boolean;
  exactCity?: boolean;
}

export interface GlobeFlowArc {
  id: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  weight: number;
}

export interface GlobeProjectedSnapshotPin {
  x: number;
  y: number;
  label: string;
  flag: string;
  valueLabel: string;
  isBot: boolean;
  isLive: boolean;
  share: number;
}

export interface GlobeCapturePayload {
  dataUrl: string;
  width: number;
  height: number;
  visiblePins: GlobeProjectedSnapshotPin[];
}

interface EarthGlobeCanvasProps {
  pins: GlobePin[];
  arcs: GlobeFlowArc[];
  showFlows: boolean;
  showBorders: boolean;
  highlightedCountryCode: string | null;
  isDark: boolean;
  autoRotate: boolean;
  selectedPinId: string | null;
  hoveredPinId: string | null;
  focusTarget: { lat: number; lng: number; nonce: number } | null;
  zoomSignal: { delta?: number; reset?: boolean; nonce: number } | null;
  onSelectPin: (pin: GlobePin) => void;
  onHoverPin: (id: string | null) => void;
  onRegisterCapture?: (captureFn: (() => GlobeCapturePayload | null) | null) => void;
}

const GLOBE_RADIUS = 1;
const MIN_CAMERA_Z = 1.32;
const MAX_CAMERA_Z = 3.7;
const DEFAULT_CAMERA_Z = 2.62;
const INITIAL_LAT = 28;
const INITIAL_LNG = 20;

function latLngToVector3(lat: number, lng: number, radius = GLOBE_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

function targetRotationsForLatLng(lat: number, lng: number): { rotX: number; rotY: number } {
  const rotX = Math.max(-1.05, Math.min(1.05, (lat * Math.PI) / 180));
  const rotY = -((lng + 90) * Math.PI) / 180;
  return { rotX, rotY };
}

function shortestAngleDiff(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** Precomputes 3D border vertex buffers (all world borders + per-country highlight borders). */
interface CountryBorderAtlasCache {
  allPositions: Float32Array;
  byCountryCode: Map<string, Float32Array>;
}

let cachedBorderAtlas: CountryBorderAtlasCache | null = null;

function pushRingSegments(ring: number[][], radius: number, out: number[]) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [lngA, latA] = ring[i];
    const [lngB, latB] = ring[i + 1];
    // Skip antimeridian wrap jumps so lines never cut across the globe interior
    if (Math.abs(lngB - lngA) > 170) continue;
    const a = latLngToVector3(latA, lngA, radius);
    const b = latLngToVector3(latB, lngB, radius);
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
}

function getCountryBorderAtlas(): CountryBorderAtlasCache {
  if (cachedBorderAtlas) return cachedBorderAtlas;

  type AtlasTopology = Parameters<typeof feature>[0];
  type AtlasGeometry = Parameters<typeof feature>[1];
  const topo = countriesAtlas as unknown as AtlasTopology & {
    objects: { countries: AtlasGeometry };
  };

  // All borders merged once via topojson.mesh
  const merged = topoMesh(
    topo as unknown as Parameters<typeof topoMesh>[0],
    topo.objects.countries as unknown as Parameters<typeof topoMesh>[1],
  );
  const allCoords: number[] = [];
  for (const line of merged.coordinates) {
    pushRingSegments(line as number[][], GLOBE_RADIUS * 1.003, allCoords);
  }

  // Per-country border loops for instant hover/selection highlight
  const fc = feature(topo, topo.objects.countries);
  const features = "features" in fc ? fc.features : [];
  const countryBuckets = new Map<string, number[]>();

  for (const f of features) {
    const rawId = String(f.id ?? "");
    const code = ISO_NUMERIC_TO_CODE.get(rawId.padStart(3, "0")) ?? ISO_NUMERIC_TO_CODE.get(rawId);
    if (!code || !f.geometry) continue;

    let bucket = countryBuckets.get(code);
    if (!bucket) {
      bucket = [];
      countryBuckets.set(code, bucket);
    }

    if (f.geometry.type === "Polygon") {
      for (const ring of f.geometry.coordinates) {
        pushRingSegments(ring as number[][], GLOBE_RADIUS * 1.0065, bucket);
      }
    } else if (f.geometry.type === "MultiPolygon") {
      for (const poly of f.geometry.coordinates) {
        for (const ring of poly) {
          pushRingSegments(ring as number[][], GLOBE_RADIUS * 1.0065, bucket);
        }
      }
    }
  }

  const byCountryCode = new Map<string, Float32Array>();
  for (const [code, arr] of countryBuckets.entries()) {
    if (arr.length > 0) byCountryCode.set(code, new Float32Array(arr));
  }

  cachedBorderAtlas = {
    allPositions: new Float32Array(allCoords),
    byCountryCode,
  };
  return cachedBorderAtlas;
}

const INNER_ATMOS_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const INNER_ATMOS_FRAG = `
  uniform vec3 uRimColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float ndotv = max(0.0, dot(vNormal, vViewDir));
    float fresnel = pow(1.0 - ndotv, 2.7);
    gl_FragColor = vec4(uRimColor, fresnel * uIntensity);
  }
`;

const OUTER_HALO_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const OUTER_HALO_FRAG = `
  uniform vec3 uHaloColor;
  uniform float uHaloPower;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float edge = clamp(0.68 - dot(vNormal, vViewDir), 0.0, 1.0);
    float alpha = pow(edge, 3.2) * uHaloPower;
    gl_FragColor = vec4(uHaloColor, alpha);
  }
`;

export function EarthGlobeCanvas({
  pins,
  arcs,
  showFlows,
  showBorders,
  highlightedCountryCode,
  isDark,
  autoRotate,
  selectedPinId,
  hoveredPinId,
  focusTarget,
  zoomSignal,
  onSelectPin,
  onHoverPin,
  onRegisterCapture,
}: EarthGlobeCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const pinElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const clusterBadgeElementsRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const clusterHintElementsRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const clusteredPinIdsRef = useRef<Set<string>>(new Set());
  const [webglError, setWebglError] = useState(false);

  const pinsRef = useRef<GlobePin[]>(pins);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const isDarkRef = useRef<boolean>(isDark);
  const showFlowsRef = useRef<boolean>(showFlows);
  const showBordersRef = useRef<boolean>(showBorders);
  const arcsRef = useRef<GlobeFlowArc[]>(arcs);
  const selectedPinIdRef = useRef<string | null>(selectedPinId);
  const hoveredPinIdRef = useRef<string | null>(hoveredPinId);
  const highlightedCountryCodeRef = useRef<string | null>(highlightedCountryCode);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    selectedPinIdRef.current = selectedPinId;
  }, [selectedPinId]);

  useEffect(() => {
    hoveredPinIdRef.current = hoveredPinId;
  }, [hoveredPinId]);

  const initialRot = targetRotationsForLatLng(INITIAL_LAT, INITIAL_LNG);
  const motionRef = useRef({
    rotX: initialRot.rotX,
    rotY: initialRot.rotY,
    targetRotX: initialRot.rotX,
    targetRotY: initialRot.rotY,
    velX: 0,
    velY: 0,
    cameraZ: DEFAULT_CAMERA_Z,
    targetCameraZ: DEFAULT_CAMERA_Z,
    dragging: false,
    flying: false,
    lastPointerX: 0,
    lastPointerY: 0,
    pausedByVisibility: false,
    reducedMotion: false,
  });

  const sceneHooksRef = useRef<{
    applyTheme: (dark: boolean) => void;
    rebuildArcs: (nextArcs: GlobeFlowArc[], visible: boolean, dark: boolean) => void;
    updateBorders: (visible: boolean, highlightCode: string | null, dark: boolean) => void;
    resumeLoop: () => void;
  } | null>(null);

  useEffect(() => {
    isDarkRef.current = isDark;
    sceneHooksRef.current?.applyTheme(isDark);
    sceneHooksRef.current?.rebuildArcs(arcsRef.current, showFlowsRef.current, isDark);
    sceneHooksRef.current?.updateBorders(showBordersRef.current, highlightedCountryCodeRef.current, isDark);
  }, [isDark]);

  useEffect(() => {
    arcsRef.current = arcs;
    showFlowsRef.current = showFlows;
    sceneHooksRef.current?.rebuildArcs(arcs, showFlows, isDarkRef.current);
  }, [arcs, showFlows]);

  useEffect(() => {
    showBordersRef.current = showBorders;
    highlightedCountryCodeRef.current = highlightedCountryCode;
    sceneHooksRef.current?.updateBorders(showBorders, highlightedCountryCode, isDarkRef.current);
  }, [showBorders, highlightedCountryCode]);

  const lastFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusTarget) return;
    const key = `${focusTarget.lat}:${focusTarget.lng}:${focusTarget.nonce}`;
    if (lastFocusKeyRef.current === key) return;
    lastFocusKeyRef.current = key;
    const { rotX, rotY } = targetRotationsForLatLng(focusTarget.lat, focusTarget.lng);
    const m = motionRef.current;
    m.targetRotX = rotX;
    m.targetRotY = m.rotY + shortestAngleDiff(m.rotY, rotY);
    m.velX = 0;
    m.velY = 0;
    m.flying = true;
    sceneHooksRef.current?.resumeLoop();
  }, [focusTarget]);

  useEffect(() => {
    if (!zoomSignal) return;
    const m = motionRef.current;
    if (zoomSignal.reset) {
      m.targetCameraZ = DEFAULT_CAMERA_Z;
    } else if (typeof zoomSignal.delta === "number") {
      m.targetCameraZ = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, m.targetCameraZ + zoomSignal.delta));
    }
    sceneHooksRef.current?.resumeLoop();
  }, [zoomSignal]);

  useEffect(() => {
    const host = canvasHostRef.current;
    const stage = stageRef.current;
    if (!host || !stage) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionRef.current.reducedMotion = motionQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      motionRef.current.reducedMotion = e.matches;
    };
    motionQuery.addEventListener("change", onMotionChange);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setWebglError(true));
      return () => {
        motionQuery.removeEventListener("change", onMotionChange);
      };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
    camera.position.set(0, 0, motionRef.current.cameraZ);

    const hemiLight = new THREE.HemisphereLight(0xf6fbff, 0xbed2de, 1.45);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.55);
    keyLight.position.set(-2.4, 2.2, 3.8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd8eefc, 0.65);
    fillLight.position.set(3.4, -0.6, 2.2);
    scene.add(fillLight);

    const globeGroup = new THREE.Group();
    globeGroup.rotation.order = "XYZ";
    globeGroup.rotation.x = motionRef.current.rotX;
    globeGroup.rotation.y = motionRef.current.rotY;
    scene.add(globeGroup);

    const textureLoader = new THREE.TextureLoader();
    const dayTex = textureLoader.load("/textures/globe/earth-day.webp");
    dayTex.colorSpace = THREE.SRGBColorSpace;
    dayTex.anisotropy = 4;

    const nightTex = textureLoader.load("/textures/globe/earth-night.webp");
    nightTex.colorSpace = THREE.SRGBColorSpace;
    nightTex.anisotropy = 4;

    const bumpTex = textureLoader.load("/textures/globe/earth-bump.webp");
    const roughTex = textureLoader.load("/textures/globe/earth-roughness.webp");
    const cloudTex = textureLoader.load("/textures/globe/earth-clouds.webp");
    cloudTex.colorSpace = THREE.SRGBColorSpace;

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96);
    const earthMat = new THREE.MeshStandardMaterial({
      map: isDarkRef.current ? nightTex : dayTex,
      bumpMap: bumpTex,
      bumpScale: 0.034,
      roughnessMap: roughTex,
      roughness: 0.92,
      metalness: 0.04,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // 3D Country Borders (single LineSegments draw call) + Selected/Hovered Highlight Outline
    const borderAtlas = getCountryBorderAtlas();
    const bordersGeo = new THREE.BufferGeometry();
    bordersGeo.setAttribute("position", new THREE.BufferAttribute(borderAtlas.allPositions, 3));
    const bordersMat = new THREE.LineBasicMaterial({
      color: isDarkRef.current ? 0x94b8e6 : 0xffffff,
      transparent: true,
      opacity: isDarkRef.current ? 0.24 : 0.34,
      depthWrite: false,
    });
    const bordersLines = new THREE.LineSegments(bordersGeo, bordersMat);
    bordersLines.visible = showBordersRef.current;
    globeGroup.add(bordersLines);

    const highlightGeo = new THREE.BufferGeometry();
    const highlightMat = new THREE.LineBasicMaterial({
      color: isDarkRef.current ? 0xc8f53a : 0x4f46e5,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const highlightLines = new THREE.LineSegments(highlightGeo, highlightMat);
    highlightLines.visible = false;
    globeGroup.add(highlightLines);

    // Drifting clouds layer
    const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.014, 72, 72);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      transparent: true,
      opacity: isDarkRef.current ? 0.2 : 0.78,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    globeGroup.add(cloudMesh);

    // Soft atmospheric rim glow
    const innerAtmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.019, 64, 64);
    const innerAtmosMat = new THREE.ShaderMaterial({
      vertexShader: INNER_ATMOS_VERT,
      fragmentShader: INNER_ATMOS_FRAG,
      uniforms: {
        uRimColor: { value: new THREE.Color(isDarkRef.current ? 0x5882c8 : 0xdff2f7) },
        uIntensity: { value: isDarkRef.current ? 0.55 : 0.72 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    scene.add(new THREE.Mesh(innerAtmosGeo, innerAtmosMat));

    const outerHaloGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.09, 64, 64);
    const outerHaloMat = new THREE.ShaderMaterial({
      vertexShader: OUTER_HALO_VERT,
      fragmentShader: OUTER_HALO_FRAG,
      uniforms: {
        uHaloColor: { value: new THREE.Color(isDarkRef.current ? 0x3b68b8 : 0xcbe8f0) },
        uHaloPower: { value: isDarkRef.current ? 0.55 : 0.75 },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(outerHaloGeo, outerHaloMat));

    // Flows group (3D Bezier arcs + moving beacons)
    const flowsGroup = new THREE.Group();
    globeGroup.add(flowsGroup);
    let flowPulses: Array<{ curve: THREE.QuadraticBezierCurve3; mesh: THREE.Mesh; phase: number; speed: number }> = [];

    const clearFlows = () => {
      while (flowsGroup.children.length > 0) {
        const child = flowsGroup.children[0];
        flowsGroup.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
      flowPulses = [];
    };

    const rebuildArcs = (nextArcs: GlobeFlowArc[], visible: boolean, dark: boolean) => {
      clearFlows();
      if (!visible || nextArcs.length === 0) return;

      const arcColor = dark ? 0xc8f53a : 0x2563eb;
      const pulseColor = dark ? 0xf8ffcf : 0xffffff;

      nextArcs.forEach((arc, index) => {
        const start = latLngToVector3(arc.fromLat, arc.fromLng, GLOBE_RADIUS * 1.009);
        const end = latLngToVector3(arc.toLat, arc.toLng, GLOBE_RADIUS * 1.009);
        const dist = start.distanceTo(end);
        if (dist < 0.03) return;

        const mid = start
          .clone()
          .add(end)
          .multiplyScalar(0.5)
          .normalize()
          .multiplyScalar(GLOBE_RADIUS + Math.min(0.42, 0.14 + dist * 0.22));

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const tubeGeo = new THREE.TubeGeometry(curve, 44, 0.0042 + arc.weight * 0.0025, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: arcColor,
          transparent: true,
          opacity: dark ? 0.62 : 0.48,
        });
        flowsGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

        const pulseGeo = new THREE.SphereGeometry(0.013, 10, 10);
        const pulseMat = new THREE.MeshBasicMaterial({
          color: pulseColor,
          transparent: true,
          opacity: 0.95,
        });
        const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
        flowsGroup.add(pulseMesh);
        flowPulses.push({
          curve,
          mesh: pulseMesh,
          phase: (index * 0.27) % 1,
          speed: 0.2 + (index % 3) * 0.04,
        });
      });
    };

    const updateBorders = (visible: boolean, highlightCode: string | null, dark: boolean) => {
      bordersLines.visible = visible;
      bordersMat.color.setHex(dark ? 0x94b8e6 : 0xffffff);
      bordersMat.opacity = dark ? 0.24 : 0.36;

      highlightMat.color.setHex(dark ? 0xc8f53a : 0x4f46e5);
      if (highlightCode) {
        const buf = borderAtlas.byCountryCode.get(highlightCode.toUpperCase());
        if (buf && buf.length > 0) {
          highlightGeo.setAttribute("position", new THREE.BufferAttribute(buf, 3));
          highlightGeo.computeBoundingSphere();
          highlightLines.visible = true;
          return;
        }
      }
      highlightLines.visible = false;
    };

    const applyTheme = (dark: boolean) => {
      earthMat.map = dark ? nightTex : dayTex;
      earthMat.bumpScale = dark ? 0.022 : 0.036;
      earthMat.roughness = dark ? 0.84 : 0.92;
      earthMat.needsUpdate = true;

      cloudMat.opacity = dark ? 0.18 : 0.78;
      hemiLight.intensity = dark ? 1.25 : 1.48;
      hemiLight.color.setHex(dark ? 0xb4ccf0 : 0xf6fbff);
      hemiLight.groundColor.setHex(dark ? 0x162033 : 0xc0d4e0);
      keyLight.intensity = dark ? 1.15 : 1.55;
      fillLight.intensity = dark ? 0.55 : 0.68;

      innerAtmosMat.uniforms.uRimColor.value.setHex(dark ? 0x5882c8 : 0xdff2f7);
      innerAtmosMat.uniforms.uIntensity.value = dark ? 0.55 : 0.72;
      outerHaloMat.uniforms.uHaloColor.value.setHex(dark ? 0x3b68b8 : 0xcbe8f0);
      outerHaloMat.uniforms.uHaloPower.value = dark ? 0.55 : 0.75;
    };

    applyTheme(isDarkRef.current);
    rebuildArcs(arcsRef.current, showFlowsRef.current, isDarkRef.current);
    updateBorders(showBordersRef.current, highlightedCountryCodeRef.current, isDarkRef.current);

    const FALLBACK_STAGE_PX = 640;
    let width = host.clientWidth > 0 ? host.clientWidth : FALLBACK_STAGE_PX;
    let height = host.clientHeight > 0 ? host.clientHeight : FALLBACK_STAGE_PX;
    const resize = () => {
      width = Math.max(host.clientWidth, 1);
      height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(host);

    // Multi-touch pinch + pointer drag + double-click zoom
    const activePointers = new Map<number, { x: number; y: number }>();
    let lastPinchDist: number | null = null;

    const getPinchDistance = (): number | null => {
      if (activePointers.size < 2) return null;
      const pts = Array.from(activePointers.values());
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest("button, a, input, select")) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const m = motionRef.current;

      if (activePointers.size === 1) {
        m.dragging = true;
        m.flying = false;
        m.velX = 0;
        m.velY = 0;
        m.lastPointerX = e.clientX;
        m.lastPointerY = e.clientY;
        lastPinchDist = null;
      } else if (activePointers.size === 2) {
        m.dragging = false;
        lastPinchDist = getPinchDistance();
      }
      host.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const m = motionRef.current;

      if (activePointers.size >= 2) {
        const nextDist = getPinchDistance();
        if (nextDist !== null && lastPinchDist !== null) {
          const delta = (lastPinchDist - nextDist) * 0.0045;
          m.targetCameraZ = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, m.targetCameraZ + delta));
        }
        lastPinchDist = nextDist;
        return;
      }

      if (!m.dragging) return;
      const dx = e.clientX - m.lastPointerX;
      const dy = e.clientY - m.lastPointerY;
      m.lastPointerX = e.clientX;
      m.lastPointerY = e.clientY;

      const scale = 0.0052 * (m.cameraZ / DEFAULT_CAMERA_Z);
      m.rotY += dx * scale;
      m.rotX = Math.max(-1.15, Math.min(1.15, m.rotX + dy * scale));
      m.velY = dx * scale * 0.65;
      m.velX = dy * scale * 0.65;
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      const m = motionRef.current;
      if (activePointers.size < 2) lastPinchDist = null;
      if (activePointers.size === 0) m.dragging = false;
      try {
        host.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest("button, a, input, select")) return;
      const m = motionRef.current;
      m.targetCameraZ = Math.max(MIN_CAMERA_Z, m.targetCameraZ - 0.32);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && !document.fullscreenElement) return;
      e.preventDefault();
      const m = motionRef.current;
      m.targetCameraZ = Math.max(
        MIN_CAMERA_Z,
        Math.min(MAX_CAMERA_Z, m.targetCameraZ + e.deltaY * 0.0018),
      );
    };

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("dblclick", onDoubleClick);
    host.addEventListener("wheel", onWheel, { passive: false });

    const tempWorld = new THREE.Vector3();
    const tempProjected = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();
    const tempToCam = new THREE.Vector3();
    const clock = new THREE.Clock();

    let rafId: number | null = null;
    let disposed = false;

    const projectVisiblePins = () => {
      const activePins = pinsRef.current;
      const selId = selectedPinIdRef.current;
      const hovId = hoveredPinIdRef.current;

      // Zoom-aware minimum pixel spacing: tighter when zoomed in, wider when zoomed out
      const zoomNorm = Math.max(
        0,
        Math.min(1, (motionRef.current.cameraZ - MIN_CAMERA_Z) / (MAX_CAMERA_Z - MIN_CAMERA_Z)),
      );
      const minSpacingPx = 11 + zoomNorm * 22;

      type ProjectedCandidate = {
        pin: GlobePin;
        sx: number;
        sy: number;
        facing: number;
        edgeFade: number;
        scale: number;
        priority: number;
      };

      const candidates: ProjectedCandidate[] = [];
      for (const pin of activePins) {
        tempWorld.copy(latLngToVector3(pin.lat, pin.lng, GLOBE_RADIUS * 1.016));
        tempWorld.applyMatrix4(globeGroup.matrixWorld);
        tempNormal.copy(tempWorld).normalize();
        tempToCam.copy(camera.position).sub(tempWorld).normalize();
        const facing = tempNormal.dot(tempToCam);

        if (facing <= 0.14) {
          const el = pinElementsRef.current.get(pin.id);
          if (el) {
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
          }
          continue;
        }

        tempProjected.copy(tempWorld).project(camera);
        const sx = (tempProjected.x * 0.5 + 0.5) * width;
        const sy = (-tempProjected.y * 0.5 + 0.5) * height;
        const edgeFade = Math.min(1, (facing - 0.14) / 0.24);
        const scale = 0.85 + Math.min(0.28, facing * 0.22);
        const priority =
          pin.id === selId || pin.id === hovId
            ? Number.MAX_SAFE_INTEGER
            : pin.visitors + (pin.liveUsers ?? 0) * 1000;

        candidates.push({ pin, sx, sy, facing, edgeFade, scale, priority });
      }

      // Highest-priority pins claim screen space first; nearby pins cluster cleanly under them
      candidates.sort((a, b) => b.priority - a.priority);
      const kept: Array<{ cand: ProjectedCandidate; hiddenNames: string[] }> = [];
      const nextClustered = new Set<string>();

      for (const cand of candidates) {
        let mergedInto: { cand: ProjectedCandidate; hiddenNames: string[] } | null = null;
        if (cand.priority !== Number.MAX_SAFE_INTEGER) {
          for (const existing of kept) {
            const dx = cand.sx - existing.cand.sx;
            const dy = cand.sy - existing.cand.sy;
            if (dx * dx + dy * dy < minSpacingPx * minSpacingPx) {
              mergedInto = existing;
              break;
            }
          }
        }

        if (mergedInto) {
          mergedInto.hiddenNames.push(cand.pin.label);
          nextClustered.add(mergedInto.cand.pin.id);
          const el = pinElementsRef.current.get(cand.pin.id);
          if (el) {
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
          }
        } else {
          kept.push({ cand, hiddenNames: [] });
        }
      }

      clusteredPinIdsRef.current = nextClustered;

      const snapshotPins: GlobeProjectedSnapshotPin[] = [];
      for (const { cand, hiddenNames } of kept) {
        const el = pinElementsRef.current.get(cand.pin.id);
        if (el) {
          el.style.transform = `translate3d(${cand.sx.toFixed(1)}px, ${cand.sy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${cand.scale.toFixed(3)})`;
          el.style.opacity = cand.edgeFade.toFixed(3);
          el.style.pointerEvents = cand.edgeFade > 0.35 ? "auto" : "none";
        }
        const badge = clusterBadgeElementsRef.current.get(cand.pin.id);
        if (badge) {
          if (hiddenNames.length > 0) {
            badge.textContent = `+${hiddenNames.length}`;
            badge.style.display = "inline-flex";
          } else {
            badge.style.display = "none";
          }
        }
        const hint = clusterHintElementsRef.current.get(cand.pin.id);
        if (hint) {
          if (hiddenNames.length > 0) {
            const preview = hiddenNames.slice(0, 2).join(", ");
            const more = hiddenNames.length > 2 ? ` +${hiddenNames.length - 2}` : "";
            hint.textContent = `Nearby (click to zoom): ${preview}${more}`;
            hint.style.display = "block";
          } else {
            hint.style.display = "none";
          }
        }
        if (cand.edgeFade > 0.4) {
          snapshotPins.push({
            x: cand.sx,
            y: cand.sy,
            label: cand.pin.label,
            flag: cand.pin.flag,
            valueLabel: `${count(cand.pin.visitors)} ${cand.pin.metricUnit ?? "visitors"}`,
            isBot: Boolean(cand.pin.botHubReason),
            isLive: (cand.pin.liveUsers ?? 0) > 0,
            share: cand.pin.share,
          });
        }
      }

      return snapshotPins;
    };

    const renderFrame = () => {
      if (disposed || motionRef.current.pausedByVisibility) {
        rafId = null;
        return;
      }

      const dt = Math.min(clock.getDelta(), 0.05);
      const m = motionRef.current;

      if (m.flying) {
        const ease = m.reducedMotion ? 1 : 1 - Math.exp(-5.4 * dt);
        m.rotX += (m.targetRotX - m.rotX) * ease;
        m.rotY += (m.targetRotY - m.rotY) * ease;
        if (Math.abs(m.targetRotX - m.rotX) < 0.002 && Math.abs(m.targetRotY - m.rotY) < 0.002) {
          m.rotX = m.targetRotX;
          m.rotY = m.targetRotY;
          m.flying = false;
        }
      } else if (!m.dragging) {
        m.rotY += m.velY;
        m.rotX = Math.max(-1.15, Math.min(1.15, m.rotX + m.velX));
        m.velY *= Math.pow(0.92, dt * 60);
        m.velX *= Math.pow(0.9, dt * 60);
        if (Math.abs(m.velY) < 0.0001) m.velY = 0;
        if (Math.abs(m.velX) < 0.0001) m.velX = 0;

        if (autoRotateRef.current && !m.reducedMotion) {
          m.rotY += 0.055 * dt;
        }
      }

      const zoomEase = m.reducedMotion ? 1 : 1 - Math.exp(-7 * dt);
      m.cameraZ += (m.targetCameraZ - m.cameraZ) * zoomEase;
      camera.position.z = m.cameraZ;

      globeGroup.rotation.x = m.rotX;
      globeGroup.rotation.y = m.rotY;

      if (!m.reducedMotion) {
        cloudMesh.rotation.y += 0.014 * dt;
      }

      if (flowPulses.length > 0) {
        for (const p of flowPulses) {
          if (!m.reducedMotion) {
            p.phase = (p.phase + p.speed * dt) % 1;
          }
          p.curve.getPointAt(p.phase, p.mesh.position);
        }
      }

      globeGroup.updateMatrixWorld(true);
      renderer.render(scene, camera);
      projectVisiblePins();

      rafId = window.requestAnimationFrame(renderFrame);
    };

    const startLoop = () => {
      if (disposed || rafId !== null || motionRef.current.pausedByVisibility) return;
      clock.getDelta();
      rafId = window.requestAnimationFrame(renderFrame);
    };

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    // Synchronous on-demand snapshot capture (renders one fresh frame before toDataURL)
    onRegisterCapture?.(() => {
      if (disposed) return null;
      globeGroup.updateMatrixWorld(true);
      renderer.render(scene, camera);
      const visiblePins = projectVisiblePins();
      return {
        dataUrl: renderer.domElement.toDataURL("image/png"),
        width,
        height,
        visiblePins,
      };
    });

    sceneHooksRef.current = {
      applyTheme,
      rebuildArcs,
      updateBorders,
      resumeLoop: startLoop,
    };

    const stageContainer = stage.closest(".globe-stage") as HTMLElement | null;
    const visibilityTarget = stageContainer ?? stage;
    const supportsContentVisibility = "contentVisibility" in document.documentElement.style;

    const onContentVisibilityChange = (event: Event) => {
      const skipped = Boolean((event as Event & { skipped?: boolean }).skipped);
      motionRef.current.pausedByVisibility = skipped || document.hidden;
      if (motionRef.current.pausedByVisibility) stopLoop();
      else startLoop();
    };

    let ioFallback: IntersectionObserver | null = null;
    if (supportsContentVisibility) {
      visibilityTarget.addEventListener("contentvisibilityautostatechange", onContentVisibilityChange);
    } else {
      ioFallback = new IntersectionObserver(
        (entries) => {
          const isVisible = entries.some((entry) => entry.isIntersecting);
          motionRef.current.pausedByVisibility = !isVisible || document.hidden;
          if (motionRef.current.pausedByVisibility) stopLoop();
          else startLoop();
        },
        { rootMargin: "200px" },
      );
      ioFallback.observe(visibilityTarget);
    }

    const onDocVisibility = () => {
      motionRef.current.pausedByVisibility = document.hidden;
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onDocVisibility);

    startLoop();

    return () => {
      disposed = true;
      stopLoop();
      onRegisterCapture?.(null);
      sceneHooksRef.current = null;
      motionQuery.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onDocVisibility);
      if (supportsContentVisibility) {
        visibilityTarget.removeEventListener("contentvisibilityautostatechange", onContentVisibilityChange);
      }
      ioFallback?.disconnect();
      resizeObserver.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
      host.removeEventListener("dblclick", onDoubleClick);
      host.removeEventListener("wheel", onWheel);
      clearFlows();
      earthGeo.dispose();
      earthMat.dispose();
      bordersGeo.dispose();
      bordersMat.dispose();
      highlightGeo.dispose();
      highlightMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      innerAtmosGeo.dispose();
      innerAtmosMat.dispose();
      outerHaloGeo.dispose();
      outerHaloMat.dispose();
      dayTex.dispose();
      nightTex.dispose();
      bumpTex.dispose();
      roughTex.dispose();
      cloudTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [onRegisterCapture]);

  if (webglError) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-xs text-brand-500">
        Interactive 3D Earth requires WebGL. Switch to the 2D Map view below to explore visitor locations.
      </div>
    );
  }

  return (
    <div ref={stageRef} className="relative h-full w-full select-none overflow-hidden">
      <div
        ref={canvasHostRef}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-none"
        role="img"
        aria-label="Interactive 3D Earth showing global visitor distribution. Drag to rotate, double-click to zoom, and click markers to inspect regions."
      />

      {/* Projected crisp HTML/CSS glowing pins with zoom-aware cluster badges */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pins.map((pin) => {
          const isSelected = selectedPinId === pin.id;
          const isHovered = hoveredPinId === pin.id;
          const isLive = (pin.liveUsers ?? 0) > 0;
          const isBot = Boolean(pin.botHubReason);
          const isTarget = Boolean(pin.isTargetGap);
          const active = isSelected || isHovered;
          const ringSize = isTarget ? "h-8 w-8" : pin.share > 0.35 ? "h-9 w-9" : pin.share > 0.08 ? "h-7 w-7" : "h-6 w-6";
          const unit = pin.metricUnit ?? "visitors";

          return (
            <button
              key={pin.id}
              ref={(node) => {
                if (node) pinElementsRef.current.set(pin.id, node);
                else pinElementsRef.current.delete(pin.id);
              }}
              type="button"
              style={{ opacity: 0, willChange: "transform, opacity" }}
              onClick={() => {
                if (clusteredPinIdsRef.current.has(pin.id)) {
                  const m = motionRef.current;
                  m.targetCameraZ = Math.max(MIN_CAMERA_Z, m.targetCameraZ - 0.52);
                }
                onSelectPin(pin);
              }}
              onMouseEnter={() => onHoverPin(pin.id)}
              onMouseLeave={() => onHoverPin(null)}
              onFocus={() => onHoverPin(pin.id)}
              onBlur={() => onHoverPin(null)}
              aria-label={
                isTarget
                  ? `${pin.label}: target market gap (${count(pin.visitors)} visits)`
                  : `${pin.label}: ${count(pin.visitors)} ${unit} (${percent(pin.share)})${isBot ? " — cloud/bot hub" : ""}`
              }
              className={cn(
                "group absolute left-0 top-0 z-10 flex items-center justify-center rounded-full focus-visible:z-40 cursor-pointer",
                isHovered ? "z-40 globe-pin-active" : isSelected ? "z-20 globe-pin-active" : "",
                isLive ? "globe-pin-live" : isTarget ? "globe-pin-target" : isBot ? "globe-pin-bot" : "",
              )}
            >
              {(active || isLive) && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "globe-pin-ring-pulse pointer-events-none absolute rounded-full",
                    ringSize,
                  )}
                />
              )}

              <span
                className={cn(
                  "globe-pin-halo flex items-center justify-center rounded-full transition-transform duration-200",
                  ringSize,
                  active ? "scale-115" : "group-hover:scale-110",
                )}
              >
                <span className="globe-pin-core h-2.5 w-2.5 rounded-full" />
              </span>

              {/* Dynamic zoom-cluster count badge (+N nearby pins hidden at current zoom) */}
              <span
                ref={(node) => {
                  if (node) clusterBadgeElementsRef.current.set(pin.id, node);
                  else clusterBadgeElementsRef.current.delete(pin.id);
                }}
                style={{ display: "none" }}
                className="globe-cluster-badge pointer-events-none absolute -top-1.5 -right-2 h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold leading-none"
              />

              {active && (
                <span className="globe-glass-pill pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-left text-[11px] text-brand-950">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span>{pin.flag}</span>
                    <span>{pin.label}</span>
                    {isLive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-1.5 py-0.5 text-[9.5px] font-bold text-success-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                        {pin.liveUsers} live
                      </span>
                    )}
                    {isTarget && (
                      <span className="inline-flex items-center rounded-full bg-primary-50 px-1.5 py-0.5 text-[9.5px] font-bold text-primary-700">
                        Target Gap
                      </span>
                    )}
                    {isBot && (
                      <span className="inline-flex items-center rounded-full bg-warning-50 px-1.5 py-0.5 text-[9.5px] font-bold text-warning-700">
                        Cloud/Bot
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-brand-500">
                    {isTarget
                      ? `${count(pin.visitors)} visits · Target service market`
                      : `${count(pin.visitors)} ${unit} · ${percent(pin.share)}${pin.exactCity === false ? " · approx. region" : ""}`}
                  </span>
                  <span
                    ref={(node) => {
                      if (node) clusterHintElementsRef.current.set(pin.id, node);
                      else clusterHintElementsRef.current.delete(pin.id);
                    }}
                    style={{ display: "none" }}
                    className="mt-0.5 text-[9.5px] font-medium text-primary-700"
                  />
                  {pin.botHubReason && (
                    <span className="mt-0.5 block text-[9.5px] text-warning-700">
                      {pin.botHubReason}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
