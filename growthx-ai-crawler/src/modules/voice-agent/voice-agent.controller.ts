import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceChatRequest } from './voice-agent.types';

interface AuthRequest extends Request {
  user: { userId: string; email: string; organizationId: string };
  organizationId: string;
}

@ApiTags('Voice Agent')
@Controller('api/voice')
@UseGuards(JwtAuthGuard)
export class VoiceAgentController {
  constructor(private readonly voiceAgent: VoiceAgentService) {}

  /** Create a new voice session. Returns sessionId. */
  @Post('session')
  @ApiOperation({ summary: 'Create Aiva voice session' })
  async createSession(
    @Req() req: AuthRequest,
    @Body() body: { projectId?: string },
  ) {
    const sessionId = await this.voiceAgent.createSession(
      req.user.userId,
      req.organizationId,
      body.projectId,
    );
    return { sessionId, createdAt: new Date().toISOString() };
  }

  /** Send a text command to Aiva and receive a structured action response. */
  @Post('chat')
  @ApiOperation({ summary: 'Send text command to Aiva voice agent' })
  async chat(
    @Req() req: AuthRequest,
    @Body() body: VoiceChatRequest,
  ) {
    if (!body.text?.trim()) {
      return { success: false, spokenSummary: 'I did not catch anything. Please try again.', tool: null, data: null };
    }
    return this.voiceAgent.dispatch(body, req.user.userId, req.organizationId);
  }

  /** Retrieve conversation history for a session. */
  @Get('history/:sessionId')
  @ApiOperation({ summary: 'Get voice conversation history' })
  async getHistory(
    @Req() req: AuthRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.voiceAgent.getSession(sessionId, req.user.userId);
  }
}
