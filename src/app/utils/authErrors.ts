export function translateAuthErrorMessage(message?: string): string {
  const rawMessage = String(message || '').trim();
  if (!rawMessage) return 'Ocorreu um erro inesperado.';

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('email rate limit exceeded') ||
    lower.includes('rate limit exceeded') ||
    lower.includes('too many requests') ||
    lower.includes('for security purposes')
  ) {
    return 'Limite de solicitações excedido. Aguarde alguns minutos antes de tentar novamente.';
  }

  if (
    lower.includes('user already registered') ||
    lower.includes('email already registered') ||
    lower.includes('already registered') ||
    lower.includes('user already exists')
  ) {
    return 'Este e-mail já está registrado. Tente iniciar sessão ou use outro e-mail.';
  }

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('wrong password') ||
    lower.includes('incorrect password')
  ) {
    return 'Credenciais inválidas. Verifique seu e-mail e senha.';
  }

  if (
    lower.includes('email not confirmed') ||
    lower.includes('email_not_confirmed') ||
    lower.includes('user email is not confirmed')
  ) {
    return 'Seu e-mail ainda não foi confirmado. Verifique a caixa de entrada e confirme o cadastro.';
  }

  if (lower.includes('invalid email') || lower.includes('email is invalid')) {
    return 'E-mail inválido. Verifique o endereço informado.';
  }

  if (
    lower.includes('signup is disabled') ||
    lower.includes('sign up is disabled') ||
    lower.includes('signups not allowed')
  ) {
    return 'O cadastro está temporariamente desativado.';
  }

  if (
    lower.includes('email link is invalid') ||
    lower.includes('otp expired') ||
    lower.includes('token has expired') ||
    lower.includes('expired token') ||
    lower.includes('invalid token') ||
    lower.includes('invalid or expired') ||
    lower.includes('invalid_grant') ||
    lower.includes('code verifier') ||
    lower.includes('code has already been used') ||
    lower.includes('invalid flow state') ||
    lower.includes('no valid flow state')
  ) {
    return 'Este link é inválido, expirou ou já foi utilizado. Solicite um novo link e tente novamente.';
  }

  if (
    lower.includes('auth session missing') ||
    lower.includes('session not found') ||
    lower.includes('refresh token not found')
  ) {
    return 'A sessão expirou. Solicite um novo link de recuperação e tente novamente.';
  }

  if (lower.includes('password should be at least') || lower.includes('password must be at least')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  if (lower.includes('new password should be different') || lower.includes('same password')) {
    return 'A nova senha deve ser diferente da senha atual.';
  }

  if (lower.includes('password is too weak') || lower.includes('weak password')) {
    return 'A senha não cumpre os requisitos de segurança. Escolha uma senha mais forte.';
  }

  return rawMessage;
}
