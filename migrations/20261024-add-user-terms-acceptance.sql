INSERT INTO public.system_settings (key, value)
VALUES (
  'system:settings',
  jsonb_build_object(
    'providerTerms',
    $provider_terms$
Termos e condições do mecânico/prestador

1. O prestador deve manter os dados do perfil e do veículo atualizados e prestar informações verdadeiras.
2. Ao ficar online ou aceitar uma solicitação, deve manter a localização ativa e usar os dados do cliente apenas para atender o serviço.
3. Deve aceitar apenas serviços que possa atender. Se não puder atender uma solicitação, deve recusá-la e informar o motivo ao cliente.
4. Deve atualizar corretamente o estado do atendimento, incluindo quando estiver a caminho, quando chegar ao local e quando o serviço estiver concluído.
5. A conclusão do serviço deve ser registada apenas depois de o atendimento ter sido realizado; o cliente confirma o encerramento pelo aplicativo.
6. A comissão da plataforma corresponde a 15% do valor final confirmado para serviços concluídos a partir da entrada em vigor desta versão. A dívida deve ser regularizada no prazo de 7 dias corridos a partir do registo da primeira dívida em aberto. Pagamentos parciais reduzem o saldo, mas não reiniciam o prazo; após 3 dias decorridos, permanecem 4/7 dias.
7. O pagamento pode ser realizado pelos métodos disponibilizados pela KuidaCar, incluindo Multicaixa Express ou IBAN, e a referência enviada fica sujeita à confirmação administrativa.
8. O prestador deve respeitar os clientes, proteger as suas informações e comunicar com o administrador quando precisar de ajuda.
9. Para ficar offline e terminar a sessão de localização, deve usar a opção de sair da conta no aplicativo.
$provider_terms$,
    'customerTerms',
    $customer_terms$
Termos e condições do cliente

1. O cliente deve fornecer informações verdadeiras, um contacto válido e a localização correta para o atendimento.
2. Antes de enviar uma solicitação, deve selecionar o serviço adequado e verificar a descrição e os dados apresentados.
3. O cliente deve manter o telefone disponível para receber chamadas, mensagens e atualizações do mecânico durante o atendimento.
4. Depois de um mecânico aceitar a solicitação, o cliente deve acompanhar o estado do serviço e comunicar pelo aplicativo qualquer alteração ou dificuldade.
5. Se precisar cancelar uma solicitação com mecânico atribuído, deve informar o motivo e comunicar com o mecânico pelo fluxo disponibilizado no aplicativo.
6. O cliente deve confirmar que o serviço foi concluído apenas depois de verificar o atendimento. Não deve confirmar um serviço que não tenha sido realizado.
7. O cliente deve tratar os mecânicos e a equipa KuidaCar com respeito e usar os dados de contacto e localização apenas para o atendimento solicitado.
8. Em caso de problema, dúvida ou desacordo, deve contactar o administrador através dos meios disponíveis na aplicação.
9. O uso da KuidaCar implica manter os dados da conta seguros e não utilizar a plataforma para solicitações falsas, abusivas ou ilegais.
$customer_terms$
  )
)
ON CONFLICT (key)
DO UPDATE SET
  value = public.system_settings.value || jsonb_build_object(
    'providerTerms',
    COALESCE(
      NULLIF(public.system_settings.value->>'providerTerms', ''),
      EXCLUDED.value->>'providerTerms'
    ),
    'customerTerms',
    COALESCE(
      NULLIF(public.system_settings.value->>'customerTerms', ''),
      EXCLUDED.value->>'customerTerms'
    ),
    'providerTermsVersion',
    COALESCE(
      public.system_settings.value->'providerTermsVersion',
      EXCLUDED.value->'providerTermsVersion'
    ),
    'customerTermsVersion',
    COALESCE(
      public.system_settings.value->'customerTermsVersion',
      EXCLUDED.value->'customerTermsVersion'
    )
  ),
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.user_terms_acceptance (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_role text NOT NULL CHECK (user_role IN ('customer', 'provider')),
  has_seen boolean NOT NULL DEFAULT false,
  terms_version integer NOT NULL DEFAULT 1,
  accepted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, user_role)
);

ALTER TABLE public.user_terms_acceptance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_terms_acceptance_select_own ON public.user_terms_acceptance;
CREATE POLICY user_terms_acceptance_select_own
  ON public.user_terms_acceptance
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_terms_acceptance_insert_own ON public.user_terms_acceptance;
CREATE POLICY user_terms_acceptance_insert_own
  ON public.user_terms_acceptance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND (
          (user_role = 'customer' AND role IN ('customer', 'client'))
          OR (user_role = 'provider' AND role IN ('provider', 'mechanic'))
        )
    )
  );

DROP POLICY IF EXISTS user_terms_acceptance_update_own ON public.user_terms_acceptance;
CREATE POLICY user_terms_acceptance_update_own
  ON public.user_terms_acceptance
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND (
          (user_role = 'customer' AND role IN ('customer', 'client'))
          OR (user_role = 'provider' AND role IN ('provider', 'mechanic'))
        )
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.user_terms_acceptance TO authenticated;
