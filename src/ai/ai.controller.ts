import { Body, Controller, Get, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';

type ExplainDto = { questionId: string; userAnswer?: number[]; lang?: string };

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  status() {
    const provider = 'groq';
    const model = (this.config.get<string>('GROQ_MODEL') || 'llama-3.1-8b-instant').trim();
    const baseUrl = 'https://api.groq.com/openai/v1';
    const hasToken = ((this.config.get<string>('GROQ_API_KEY') || '').trim()).length > 0;
    return { provider, model, baseUrl, hasToken };
  }

  @Post('explain')
  async explain(@Body() dto: ExplainDto) {
    const { questionId, userAnswer, lang } = dto || ({} as any);
    if (!questionId || typeof questionId !== 'string') {
      throw new BadRequestException('questionId manquant ou invalide');
    }
    return this.ai.explain(String(questionId), Array.isArray(userAnswer) ? userAnswer : undefined, lang || 'fr');
  }
}

