import { Link } from 'react-router-dom'
import SEO from '../components/SEO/SEO'

export default function Obrigado() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <SEO
        title="Mensagem enviada — POUSINOX®"
        description="Recebemos seu contato e retornaremos em breve."
        path="/obrigado"
      />
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" style={{ marginBottom: '24px' }}>
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a2f4e', marginBottom: '12px' }}>
          Mensagem enviada!
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '32px', lineHeight: 1.6 }}>
          Recebemos sua solicitação e nossa equipe entrará em contato em breve.<br />
          Obrigado pelo interesse na POUSINOX®!
        </p>
        <Link to="/" className="btn-primary">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
