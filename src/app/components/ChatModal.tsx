import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { apiClient, supabase } from "../utils/api";
import ErrorBoundary from './ErrorBoundary';
import { X } from 'lucide-react';

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface ChatModalProps {
  requestId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  isProvider?: boolean;
  onClose: () => void;
}

export function ChatModal({
  requestId,
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserAvatar,
  isProvider = false,
  onClose,
}: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);

  const normalizeMessage = (msg: any): Message => ({
    id: msg.id,
    sender_id: msg.sender_id,
    sender_name: msg.sender_name || (msg.sender_id === currentUserId ? "Você" : otherUserName),
    content: msg.content,
    created_at: msg.created_at,
    is_read: msg.is_read,
  });

  const isSupportResponse = Boolean(requestId && String(requestId).startsWith('support:'));

  const addMessage = (message: Message) => {
    setMessages((prev) => {
      if (prev.some((msg) => msg.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Deseja remover esta mensagem?')) return;
    try {
      // optimistic remove
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      await apiClient.deleteMessage(messageId);
      toast.success('Mensagem removida');
    } catch (err) {
      console.error('Erro ao deletar mensagem:', err);
      toast.error('Não foi possível remover a mensagem');
      // reload messages to reconcile
      loadMessages();
    }
  };

  // Carregar mensagens do banco
  const loadMessages = async () => {
    try {
      setLoadingMessages(true);
      const response = await apiClient.getMessages(requestId);
      if (response.success && Array.isArray(response.messages)) {
        setMessages(response.messages.map(normalizeMessage));
      }
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Carregar mensagens ao abrir
  useEffect(() => {
    loadMessages();

    // Limpar subscrição anterior se existir
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      if (typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(subscriptionRef.current);
      }
      subscriptionRef.current = null;
    }

    // Subscrição realtime para novas mensagens
    const subscription = supabase
      .channel(`chat_request_${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` },
        (payload) => {
          const newRecord = (payload as any).new;
          if (newRecord && newRecord.id) {
            addMessage(normalizeMessage(newRecord));
          } else {
            loadMessages();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` },
        (payload) => {
          const oldRecord = (payload as any).old;
          if (oldRecord && oldRecord.id) {
            setMessages((prev) => prev.filter((m) => m.id !== oldRecord.id));
          } else {
            loadMessages();
          }
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        if (typeof supabase.removeChannel === 'function') {
          supabase.removeChannel(subscriptionRef.current);
        }
        subscriptionRef.current = null;
      }
    };
  }, [requestId]);

  // Limpar subscrição ao desmontar componente
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!requestId) return;
    apiClient.markMessagesAsRead(requestId).catch((error) => {
      console.warn('Não foi possível marcar mensagens como lidas:', error);
    });
  }, [messages, requestId]);

  // set/clear responding flag for this request when typing
  useEffect(() => {
    const trimmed = newMessage.trim();
    if (!requestId) return;

    const kind: 'request' = 'request';
    if (trimmed.length > 0) {
      apiClient.setRespondingFlag(kind, String(requestId)).catch((err) => {
        // ignore
      });
    } else {
      apiClient.clearRespondingFlag(kind, String(requestId)).catch(() => {});
    }

    return () => {
      // clear when modal unmounts
      apiClient.clearRespondingFlag(kind, String(requestId)).catch(() => {});
    };
  }, [newMessage, requestId]);


  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const optimisticMessage: Message = {
      id: tempId,
      sender_id: currentUserId,
      sender_name: "Você",
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setLoading(true);

    try {
      const response = await apiClient.sendMessage(requestId, otherUserId, messageContent);

      if (response.success && response.message) {
        const savedMessage = normalizeMessage({
          ...response.message,
          sender_name: "Você",
        });

        setMessages((prev) => {
          const filtered = prev.filter((msg) => msg.id !== tempId);
          if (filtered.some((msg) => msg.id === savedMessage.id)) {
            return filtered;
          }
          return [...filtered, savedMessage];
        });

        toast.success("✅ Mensagem enviada");
      } else {
        toast.error("❌ Erro ao enviar mensagem");
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        setNewMessage(messageContent);
      }
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error(`❌ ${error.message || "Erro ao enviar mensagem"}`);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      setNewMessage(messageContent);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm h-96 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={otherUserAvatar} alt={otherUserName} />
              <AvatarFallback>{otherUserName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <span>{otherUserName}</span>
              {isSupportResponse && (
                <span className="text-xs ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Resposta do Suporte</span>
              )}
            </div>
            {isProvider && <span className="text-xs ml-auto bg-orange-100 text-orange-700 px-2 py-1 rounded">Prestador</span>}
          </DialogTitle>
        </DialogHeader>

        {isSupportResponse && (
          <div className="px-3 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-md mb-2">
            Esta conversa é uma resposta de suporte relacionada ao ticket #{String(requestId).replace(/^support:/, '')}. Veja os detalhes clicando em "Ver ticket".
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto space-y-3 px-1">
          {loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Nenhuma mensagem ainda. Comece a conversa!
            </div>
          ) : (
            <ErrorBoundary fallback={<div className="text-sm text-gray-500">Erro ao renderizar mensagens.</div>}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${
                    message.sender_id === currentUserId ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.sender_id !== currentUserId && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={otherUserAvatar} alt={message.sender_name} />
                      <AvatarFallback>{message.sender_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}

                  <div className="relative">
                    <div
                      className={`max-w-xs px-3 py-2 rounded-lg ${
                        message.sender_id === currentUserId
                          ? "bg-orange-600 text-white rounded-br-none"
                          : "bg-gray-200 text-gray-900 rounded-bl-none"
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <span className="text-xs opacity-70 mt-1 block">
                        {new Date(message.created_at).toLocaleTimeString("pt-AO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {(message.sender_id === currentUserId) && (
                      <button
                        title="Remover mensagem"
                        onClick={() => handleDeleteMessage(message.id)}
                        className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </ErrorBoundary>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <DialogFooter className="flex gap-2">
          <Input
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !loading) {
                handleSendMessage();
              }
            }}
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={loading || !newMessage.trim()}
            className="gap-2 bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
