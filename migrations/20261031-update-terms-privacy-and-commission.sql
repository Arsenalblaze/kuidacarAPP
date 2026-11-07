INSERT INTO public.system_settings (key, value)
VALUES (
  'system:settings',
  jsonb_build_object(
    'providerTerms',
    $provider_terms$
TERMOS E CONDIÇÕES DO MECÂNICO/PRESTADOR

1. Cadastro e perfil: mantenha verdadeiros e atualizados o nome, contacto, tipo de serviço, veículo e documentos solicitados. Não utilize documentos de outra pessoa.
2. Disponibilidade e localização: ao ficar online ou aceitar um serviço, autoriza a partilha da sua localização durante a disponibilidade e o atendimento. Use os dados do cliente somente para executar o serviço e deixe de partilhar a localização ao ficar offline.
3. Atendimento: aceite apenas serviços que possa realizar com segurança, mantenha o cliente informado sobre atrasos e atualize o estado da solicitação. Não marque chegada ou conclusão antes de acontecerem.
4. Preço e autorização: confirme com o cliente o serviço e o preço antes de começar. Não cobre trabalho, deslocação, peças ou valores adicionais sem informar previamente e obter a autorização do cliente.
5. Conclusão: só solicite a confirmação depois de realizar o serviço. A conclusão e a comissão ficam registadas após a confirmação do cliente. Não peça ao cliente para confirmar um serviço não realizado.
6. Comissão da plataforma: para serviços concluídos a partir da entrada em vigor desta versão, a comissão KuidaCar corresponde a 15% do valor final confirmado do serviço. Valores e dívidas já registados antes da entrada em vigor não são recalculados retroativamente.
7. Dívida e prazo: a comissão gera dívida do prestador. O prazo é de 7 dias corridos a partir do registo da primeira dívida ainda em aberto. Pagamentos parciais reduzem o saldo, mas não reiniciam nem prolongam esse prazo; por exemplo, depois de 3 dias decorridos, permanecem 4/7 dias. A dívida não paga até ao fim do prazo pode levar à suspensão de novas solicitações até à regularização.
8. Pagamentos: use os métodos apresentados pela KuidaCar e envie referência e valor corretos. O pagamento só reduz a dívida depois da confirmação administrativa. Um valor parcial abate a dívida; um valor excedente será tratado como saldo positivo e poderá ser aplicado a dívidas atuais/futuras ou mantido, conforme a opção apresentada. Não envie uma referência de pagamento mais de uma vez.
9. Recusas e cancelamentos: se não puder atender uma solicitação pendente, use o fluxo de recusa/cancelamento e informe o motivo. Se o atendimento já estiver em andamento ou aguardar confirmação do cliente, não o elimine unilateralmente; peça o cancelamento e aguarde a ação do cliente ou contacte o suporte.
10. Conduta e segurança: trate clientes e equipa com respeito, não discrimine, não assedie, não pratique fraude e não use a plataforma para fins ilegais. Proteja a sua conta e comunique incidentes ou reclamações pelo suporte.
11. Documentos e reclamações: os documentos enviados podem ser revistos pela administração para verificar a conta e a aptidão declarada. Responda a pedidos de esclarecimento e use o suporte para contestar uma dívida, pagamento ou reclamação.
12. Disponibilidade: desligue o estado online ou termine a sessão quando não puder aceitar serviços. O uso da aplicação não garante um número mínimo de solicitações ou rendimentos.
$provider_terms$,
    'customerTerms',
    $customer_terms$
TERMOS E CONDIÇÕES DO CLIENTE

1. Conta e solicitação: forneça dados de contacto corretos, descreva o problema com clareza e escolha o serviço adequado. Não crie solicitações falsas, abusivas ou ilegais.
2. Seleção do mecânico: selecionar um mecânico apenas o reserva temporariamente para preparar a solicitação; não significa que o pedido foi enviado. Se não enviar a solicitação, a seleção é libertada após 50 segundos.
3. Preço: confira o preço apresentado antes de enviar o pedido. O preço final deve ser confirmado com o mecânico antes do início do serviço. Peças, deslocações ou trabalhos adicionais devem ser explicados e autorizados por si antes de serem cobrados.
4. Contacto e localização: mantenha o telefone disponível durante o atendimento e forneça a localização correta. A localização e os dados da solicitação são partilhados com o mecânico atribuído para que possa prestar o serviço.
5. Cancelamento: uma solicitação sem mecânico atribuído pode ser eliminada diretamente. Quando houver mecânico atribuído, utilize o fluxo de cancelamento e informe o motivo; em algumas fases, incluindo depois da chegada do mecânico ou enquanto uma conclusão aguarda confirmação, o cancelamento pode ficar bloqueado e será necessário contactar o suporte.
6. Conclusão: confirme a conclusão apenas depois de verificar que o serviço foi realizado. Se estiver incompleto, não tiver sido realizado ou o preço estiver em desacordo, não confirme; contacte o suporte para análise.
7. Pagamento: confirme previamente o valor e pague pelos meios acordados com o prestador. Peça comprovativo quando aplicável e não partilhe códigos de autenticação ou palavras-passe.
8. Avaliações: avalie apenas serviços efetivamente recebidos e escreva comentários verdadeiros, respeitosos e sem dados pessoais desnecessários, insultos ou ameaças.
9. Privacidade e segurança: use os dados do mecânico apenas para o atendimento. Não publique nem partilhe contactos, localização, mensagens ou documentos de terceiros sem autorização. Proteja as credenciais da sua conta.
10. Reclamações: comunique problemas, cobranças não autorizadas, atrasos, danos ou conduta inadequada através do suporte KuidaCar, fornecendo os detalhes necessários para investigação.
$customer_terms$,
    'privacyNotice',
    $privacy_notice$
AVISO DE PRIVACIDADE KUIDACAR

1. Dados tratados: podemos tratar dados de conta e contacto (nome, e-mail e telefone), perfil e veículo do prestador, documentos enviados para verificação, localização, solicitações e respetivo histórico, mensagens de atendimento, referências e valores de pagamentos, avaliações, notificações e dados técnicos necessários para segurança e funcionamento.
2. Finalidades: usamos esses dados para criar e proteger contas, localizar e encaminhar prestadores, gerir solicitações e cancelamentos, permitir comunicação entre cliente e prestador, confirmar serviços e pagamentos, calcular comissões e saldos, prevenir fraude, responder a reclamações e melhorar a plataforma.
3. Partilha necessária: os dados relevantes de uma solicitação, incluindo contacto e localização, podem ser partilhados entre o cliente e o prestador atribuído. A equipa administrativa pode aceder aos dados necessários para suporte, verificação de documentos, moderação, auditoria, pagamentos e resolução de disputas. Prestadores técnicos que alojam ou operam a plataforma podem processar dados apenas para prestar esses serviços.
4. Localização: a localização do prestador é usada para disponibilidade e encaminhamento e pode ser mostrada ao cliente relacionado com o atendimento. A localização do cliente é usada para encontrar e orientar o prestador atribuído. Não use a localização recebida para outra finalidade.
5. Documentos e pagamentos: documentos de identificação e comprovativos/referências são acessíveis apenas para as verificações e operações administrativas correspondentes. Não envie dados de cartão, códigos secretos ou palavras-passe em mensagens ou referências.
6. Conservação e segurança: conservamos os dados pelo tempo necessário às finalidades do serviço, segurança, resolução de reclamações e cumprimento de obrigações aplicáveis. Aplicamos controlos de acesso e medidas de segurança, mas nenhum serviço digital pode garantir risco zero.
7. Direitos e pedidos: pode solicitar acesso, correção ou eliminação de dados pessoais, sujeito a verificações de identidade e a dados que precisem de ser conservados por motivos operacionais ou legais. Para exercer direitos ou esclarecer este aviso, contacte o suporte KuidaCar pelos contactos apresentados na aplicação.
8. Alterações: este aviso pode ser atualizado. Quando a versão for alterada, a aplicação poderá pedir nova confirmação antes de continuar a utilização.
$privacy_notice$,
    'providerTermsVersion', to_jsonb(1),
    'customerTermsVersion', to_jsonb(1),
    'privacyNoticeVersion', to_jsonb(1),
    'commissionPercentage', to_jsonb(15)
  )
)
ON CONFLICT (key)
DO UPDATE SET
  value = public.system_settings.value || jsonb_build_object(
    'providerTerms',
    EXCLUDED.value->>'providerTerms',
    'customerTerms',
    EXCLUDED.value->>'customerTerms',
    'privacyNotice',
    EXCLUDED.value->>'privacyNotice',
    'providerTermsVersion',
    CASE
      WHEN public.system_settings.value->>'providerTerms' IS DISTINCT FROM EXCLUDED.value->>'providerTerms'
        THEN to_jsonb(COALESCE(NULLIF(public.system_settings.value->>'providerTermsVersion', '')::integer, 1) + 1)
      ELSE COALESCE(public.system_settings.value->'providerTermsVersion', EXCLUDED.value->'providerTermsVersion')
    END,
    'customerTermsVersion',
    CASE
      WHEN public.system_settings.value->>'customerTerms' IS DISTINCT FROM EXCLUDED.value->>'customerTerms'
        THEN to_jsonb(COALESCE(NULLIF(public.system_settings.value->>'customerTermsVersion', '')::integer, 1) + 1)
      ELSE COALESCE(public.system_settings.value->'customerTermsVersion', EXCLUDED.value->'customerTermsVersion')
    END,
    'privacyNoticeVersion',
    CASE
      WHEN public.system_settings.value->>'privacyNotice' IS DISTINCT FROM EXCLUDED.value->>'privacyNotice'
        THEN to_jsonb(COALESCE(NULLIF(public.system_settings.value->>'privacyNoticeVersion', '')::integer, 1) + 1)
      ELSE COALESCE(public.system_settings.value->'privacyNoticeVersion', EXCLUDED.value->'privacyNoticeVersion')
    END,
    'commissionPercentage',
    EXCLUDED.value->'commissionPercentage'
  ),
  updated_at = now();
