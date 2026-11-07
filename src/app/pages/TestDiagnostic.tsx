import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { apiClient } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function TestDiagnostic() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const log = (message: string, isError = false) => {
    const prefix = isError ? '❌' : '✅';
    const fullMessage = `${prefix} ${message}`;
    console.log(fullMessage);
    setResults(prev => [...prev, fullMessage]);
  };

  const runDiagnostic = async () => {
    setResults([]);
    setLoading(true);

    const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-9dc5328a`;
    
    log(`Base URL: ${baseUrl}`);
    log(`Chave pública anónima: ${publicAnonKey.substring(0, 30)}...`);
    log('─'.repeat(50));

    // Teste 0: estado da autenticação
    log('TESTE 0: Estado da autenticação');
    log(`Utilizador autenticado: ${isAuthenticated}`);
    log(`Dados do utilizador: ${user ? JSON.stringify(user) : 'nenhum'}`);
    log(`Token existente: ${apiClient.getAccessToken() ? 'Sim' : 'Não'}`);
    log('─'.repeat(50));

    // Teste 1: verificação de disponibilidade
    log('TESTE 1: Verificação de disponibilidade');
    try {
      const response = await fetch(`${baseUrl}/health`, {
        headers: {
          "ngrok-skip-browser-warning": "true"
        }
      });
      const data = await response.json();
      log(`Estado: ${response.status}`);
      log(`Resposta: ${JSON.stringify(data)}`);
      
      if (response.ok && data.status === 'ok') {
        log('Verificação de saúde concluída com sucesso!');
      } else {
        log('Verificação de saúde falhou!', true);
      }
    } catch (error: any) {
      log(`Erro na verificação de saúde: ${error.message}`, true);
    }

    log('─'.repeat(50));

    // Teste 2: serviços pendentes (rota pública)
    log('TESTE 2: Serviços pendentes (rota pública)');
    try {
      const response = await fetch(`${baseUrl}/service/pending/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await response.json();
      log(`Estado: ${response.status}`);
      log(`Resposta: ${JSON.stringify(data)}`);
      
      if (response.ok && data.success) {
        log('Serviços pendentes OK!');
      } else {
        log('Serviços pendentes falharam!', true);
      }
    } catch (error: any) {
      log(`Erro em serviços pendentes: ${error.message}`, true);
    }

    log('─'.repeat(50));

    // Teste 3: criar solicitação de serviço (requer autenticação)
    log('TESTE 3: Criar solicitação de serviço (requer autenticação)');
    if (!isAuthenticated) {
      log('Ignorado - usuário não autenticado', true);
    } else {
      try {
        const testRequest = {
          type: 'pneus',
          description: 'Teste de diagnóstico',
          location: {
            lat: -8.8383,
            lng: 13.2344,
            address: 'Endereço de teste'
          },
          estimatedPrice: 6000
        };

        log(`A enviar solicitação: ${JSON.stringify(testRequest)}`);
        
        const response = await apiClient.createServiceRequest(testRequest);
        log(`Resposta: ${JSON.stringify(response)}`);
        
        if (response.success) {
          log('Criação da solicitação concluída com sucesso!');
        } else {
          log('Criação da solicitação falhou!', true);
        }
      } catch (error: any) {
        log(`Erro ao criar solicitação: ${error.message}`, true);
      }
    }

    // Teste 4: verificar cabeçalhos
    log('TESTE 4: Verificar cabeçalhos');
    try {
      const response = await apiClient.debugHeaders();
      log(`Headers enviados: ${JSON.stringify(response.headers)}`);
      
      if (response.success) {
        log('Cabeçalhos de depuração OK!');
      } else {
        log('Cabeçalhos de depuração falharam!', true);
      }
    } catch (error: any) {
      log(`Erro nos cabeçalhos de depuração: ${error.message}`, true);
    }

    log('─'.repeat(50));
    log('DIAGNÓSTICO CONCLUÍDO');
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">🔧 Diagnóstico KuidaCar</h1>
          
          <div className="mb-6">
            <Button 
              onClick={runDiagnostic} 
              disabled={loading}
              className="mr-4"
            >
              {loading ? 'A executar...' : 'Executar diagnóstico'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setResults([])}
            >
              Limpar resultados
            </Button>
          </div>

          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-gray-500">Selecione "Executar diagnóstico" para iniciar os testes...</p>
            ) : (
              results.map((result, index) => (
                <div key={index} className="mb-1">
                  {result}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}