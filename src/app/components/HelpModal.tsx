import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { X, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../utils/api';

interface FAQ {
  id: string;
  pergunta: string;
  resposta: string;
  ordem: number;
  ativa: boolean;
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
}

const SUPPORT_CATEGORIES = [
  'Dúvida',
  'Reclamação',
  'Sugestão',
  'Problema Técnico',
  'Outro',
];

export function HelpModal({ isOpen, onClose, userId }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<'faq' | 'support'>('faq');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [faqLoading, setFaqLoading] = useState(false);

  // Support ticket form states
  const [supportCategory, setSupportCategory] = useState('');
  const [supportAssunto, setSupportAssunto] = useState('');
  const [supportMensagem, setSupportMensagem] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'faq') {
      loadFaqs();
    }
  }, [isOpen, activeTab]);

  const loadFaqs = async () => {
    try {
      setFaqLoading(true);
      const response = await apiClient.getFaqList();
      if (response.success) {
        setFaqs(response.faqs || []);
        return;
      }

      const errorText = response.error || 'Erro ao carregar perguntas frequentes';
      if (errorText.toLowerCase().includes('does not exist') || errorText.toLowerCase().includes('relation')) {
        setFaqs([]);
        toast.error('A tabela de FAQ ainda não foi criada no banco de dados.');
        return;
      }

      setFaqs([]);
      toast.error('Erro ao carregar perguntas frequentes');
    } catch (error) {
      console.error('Erro ao carregar FAQs:', error);
      setFaqs([]);
      toast.error('Erro ao carregar perguntas frequentes');
    } finally {
      setFaqLoading(false);
    }
  };

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supportCategory || !supportAssunto || !supportMensagem) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    if (!userId) {
      toast.error('Você precisa estar logado para enviar uma mensagem');
      return;
    }

    try {
      setSupportLoading(true);
      const response = await apiClient.createSupportTicket(
        supportCategory,
        supportAssunto,
        supportMensagem,
        userId || undefined
      );

      if (response.success) {
        toast.success('✅ Mensagem enviada com sucesso! Responderemos em breve.');
        setSupportCategory('');
        setSupportAssunto('');
        setSupportMensagem('');
        return;
      }

      const errorText = response.error || 'Erro ao enviar mensagem';
      if (errorText.toLowerCase().includes('does not exist') || errorText.toLowerCase().includes('relation')) {
        toast.error('A tabela de reclamações ainda não foi criada no banco de dados.');
        return;
      }

      if (errorText.toLowerCase().includes('policy') || errorText.toLowerCase().includes('security') || errorText.toLowerCase().includes('permission')) {
        toast.error('Permissão negada ao salvar a reclamação. Verifique as políticas do Supabase.');
        return;
      }

      toast.error(errorText);
    } catch (error: any) {
      console.error('Erro ao enviar support ticket:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setSupportLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-white border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Centro de Ajuda</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex gap-2 border-b mb-4">
          <button
            onClick={() => setActiveTab('faq')}
            className={`pb-3 px-4 font-medium border-b-2 transition-colors ${
              activeTab === 'faq'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Perguntas Frequentes KuidaCar
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`pb-3 px-4 font-medium border-b-2 transition-colors ${
              activeTab === 'support'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Dúvidas e Reclamações
          </button>
        </div>

        {/* FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="space-y-3">
            {faqLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-600">Carregando perguntas frequentes...</p>
              </div>
            ) : faqs.length > 0 ? (
              faqs.map((faq) => (
                <Card
                  key={faq.id}
                  className="overflow-hidden hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() =>
                      setExpandedFaqId(
                        expandedFaqId === faq.id ? null : faq.id
                      )
                    }
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="font-medium text-left text-gray-900">
                      {faq.pergunta}
                    </span>
                    {expandedFaqId === faq.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {expandedFaqId === faq.id && (
                    <div className="px-4 py-3 border-t bg-gray-50">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {faq.resposta}
                      </p>
                    </div>
                  )}
                </Card>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">
                  Nenhuma pergunta frequente disponível no momento.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <form onSubmit={handleSubmitSupport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Categoria *
              </label>
              <select
                value={supportCategory}
                onChange={(e) => setSupportCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Selecione uma categoria</option>
                {SUPPORT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Assunto *
              </label>
              <Input
                value={supportAssunto}
                onChange={(e) => setSupportAssunto(e.target.value)}
                placeholder="Descreva brevemente seu assunto"
                maxLength={100}
              />
              <p className="text-xs text-gray-500 mt-1">
                {supportAssunto.length}/100
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Mensagem *
              </label>
              <Textarea
                value={supportMensagem}
                onChange={(e) => setSupportMensagem(e.target.value)}
                placeholder="Descreva seu problema, dúvida ou sugestão..."
                rows={5}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {supportMensagem.length}/500
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={supportLoading}
                className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2"
              >
                <Send className="w-4 h-4" />
                {supportLoading ? 'Enviando...' : 'Enviar Mensagem'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSupportCategory('');
                  setSupportAssunto('');
                  setSupportMensagem('');
                }}
                disabled={supportLoading}
              >
                Limpar
              </Button>
            </div>

            <p className="text-xs text-gray-600 bg-blue-50 p-3 rounded">
              ℹ️ Sua mensagem será respondida pelo administrador em até 24 horas.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
