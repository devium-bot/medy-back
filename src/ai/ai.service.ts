import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question, QuestionDocument } from '../questions/schemas/question.schema';

@Injectable()
export class AiService {
  private groqKey?: string;
  private groqModel: string;
  private baseUrl = 'https://api.groq.com/openai/v1';

  constructor(
    private readonly config: ConfigService,
    @InjectModel(Question.name) private readonly questionModel: Model<QuestionDocument>,
  ) {
    const key = (this.config.get<string>('GROQ_API_KEY') || '').trim();
    this.groqKey = key || undefined;
    this.groqModel = (this.config.get<string>('GROQ_MODEL') || 'llama-3.1-8b-instant').trim();
  }

  private buildPrompt(q: QuestionDocument, userAnswer?: number[]): string {
    const options = (q.options || []).map((opt: string, idx: number) => `- (${idx + 1}) ${opt}`).join('\n');
    const correctIdx = Array.isArray(q.correctAnswer) ? q.correctAnswer.map((i) => i + 1).join(', ') : '';
    const userIdx = Array.isArray(userAnswer) && userAnswer.length
      ? userAnswer.map((i) => i + 1).join(', ')
      : 'aucune';
    const speciality = (q as any)?.speciality ? `Spécialité: ${(q as any).speciality}.` : '';
    return [
      'Tu es un tuteur médical. Explique en détail et de façon pédagogique en français pourquoi la/les réponse(s) correcte(s) sont justes et pourquoi les autres options sont fausses.',
      'Structure: un court rappel du concept, puis une justification par option, concise et claire. Pas de texte inutile.',
      speciality,
      `Question: ${q.questionText}`,
      'Options:',
      options,
      `Réponses correctes: ${correctIdx}. Réponse de l’utilisateur: ${userIdx}.`,
      'Réponse attendue: une explication utile (150-250 mots) en français, avec puces si nécessaire.',
    ].filter(Boolean).join('\n');
  }

  async explain(questionId: string, userAnswer?: number[], lang = 'fr') {
    if (!questionId || !Types.ObjectId.isValid(String(questionId))) {
      throw new ServiceUnavailableException('questionId invalide');
    }
    const question = await this.questionModel.findById(questionId);
    if (!question) throw new ServiceUnavailableException('Question introuvable');

    if (!this.groqKey) {
      throw new ServiceUnavailableException('GROQ_API_KEY manquant');
    }

    const prompt = this.buildPrompt(question, userAnswer);

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.groqModel,
        messages: [
          { role: 'system', content: 'Tu es un tuteur médical. Réponds en français, de manière pédagogique et structurée.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 400,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ServiceUnavailableException(`Groq API error: ${res.status} ${text}`);
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return { explanation: content, model: this.groqModel, provider: 'groq', cached: false };
  }
}

