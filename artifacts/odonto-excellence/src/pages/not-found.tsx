import { Link } from 'wouter';
import { ArrowLeft, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 bg-background">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary grid place-items-center">
        <SearchX size={28} />
      </div>
      <div className="text-center">
        <p className="eyebrow mb-3">Erro 404</p>
        <h1 className="page-title mb-3">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta rota não existe. Volte para o painel ou o início.
        </p>
      </div>
      <Link href="/" className="btn-menu">
        <ArrowLeft size={15} /> Voltar ao início
      </Link>
    </div>
  );
}
