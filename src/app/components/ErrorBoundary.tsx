import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary detectou erro:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-4 rounded bg-red-50 border border-red-200 text-red-700">
          <div className="font-semibold">Ocorreu um erro na visualização das mensagens.</div>
          <div className="mt-2 text-sm">Tente recarregar a lista ou feche e reabra o painel.</div>
          <div className="mt-3">
            <button className="px-3 py-1 bg-red-100 text-red-700 rounded" onClick={this.handleReset}>Tentar novamente</button>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}
