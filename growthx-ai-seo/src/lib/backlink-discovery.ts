export type BacklinkDiscoveryStatus = {
  available: boolean;
  coverage: string;
  index: {edges:number;pages:number;slices:number;capacity:number;lastIndexedAt:string|null;note:string};
  run: null | {
    id:string;status:string;stage:string;candidates:number;added:number;checked:number;verified:number;
    startedAt:string;finishedAt:string|null;error:string|null;
    details:Array<{provider:string;status:string;candidates:number;reason?:string}>;
  };
};
