import SEO from '../components/SEO/SEO'

export default function Privacidade() {
  return (
    <>
      <SEO
        title="Política de Privacidade | Pousinox"
        description="Política de Privacidade da Pousinox — como coletamos, usamos e protegemos seus dados pessoais conforme a LGPD."
        path="/privacidade"
      />
      <section style={{ paddingTop: 'calc(var(--header-height) + 48px)', paddingBottom: 64, background: '#fff' }}>
        <div className="container" style={{ maxWidth: 780 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Política de Privacidade</h1>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 32 }}>Última atualização: 25 de abril de 2026</p>

          <div style={{ fontSize: '0.92rem', color: '#374151', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>1. Quem somos</h2>
              <p>A <strong>POUSINOX INDÚSTRIA E COMÉRCIO DE INOX LTDA</strong>, inscrita no CNPJ sob nº 26.434.252/0001-20, com sede em Av. Antonio Mariosa, 4545, São Geraldo, Pouso Alegre/MG, CEP 37550-000, é responsável pelo tratamento dos dados pessoais coletados neste site.</p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>2. Dados que coletamos</h2>
              <p>Coletamos os seguintes dados pessoais, conforme a finalidade:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li><strong>Formulário de contato e orçamento:</strong> nome, e-mail, telefone/WhatsApp, empresa, CNPJ, cidade e estado.</li>
                <li><strong>Interesse em produtos:</strong> nome e WhatsApp para envio de informações sobre disponibilidade e preços.</li>
                <li><strong>Checkout / compra:</strong> nome, CPF/CNPJ, telefone, e-mail, endereço completo para entrega e emissão de nota fiscal.</li>
                <li><strong>Navegação:</strong> cookies de analytics (Google Analytics) que registram páginas visitadas, tempo de permanência e origem do acesso. Nenhum dado pessoal identificável é compartilhado com terceiros para fins de publicidade.</li>
              </ul>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>3. Finalidade do tratamento</h2>
              <ul style={{ paddingLeft: 20 }}>
                <li>Responder solicitações de contato e orçamento.</li>
                <li>Processar pedidos e entregas de produtos.</li>
                <li>Enviar informações sobre disponibilidade e preços de produtos de interesse.</li>
                <li>Melhorar a experiência de navegação e o desempenho do site.</li>
                <li>Cumprir obrigações legais e fiscais.</li>
              </ul>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>4. Base legal</h2>
              <p>O tratamento de dados pessoais é realizado com base no consentimento do titular (Art. 7º, I, LGPD), na execução de contrato (Art. 7º, V) e no cumprimento de obrigação legal (Art. 7º, II).</p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>5. Compartilhamento de dados</h2>
              <p>Seus dados podem ser compartilhados com:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li><strong>Correios e transportadoras:</strong> para cálculo e execução de frete.</li>
                <li><strong>Google Analytics:</strong> dados de navegação anonimizados para análise de desempenho do site.</li>
                <li><strong>Supabase:</strong> plataforma de banco de dados onde os dados são armazenados com criptografia.</li>
              </ul>
              <p style={{ marginTop: 8 }}>Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros para fins de marketing.</p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>6. Cookies</h2>
              <p>Utilizamos cookies essenciais para o funcionamento do site e cookies de analytics para compreender o comportamento de navegação. Você pode recusar cookies não essenciais através do banner exibido na primeira visita.</p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>7. Seus direitos</h2>
              <p>Conforme a LGPD (Lei 13.709/2018), você tem direito a:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li>Confirmar a existência de tratamento de dados.</li>
                <li>Acessar, corrigir ou excluir seus dados pessoais.</li>
                <li>Revogar o consentimento a qualquer momento.</li>
                <li>Solicitar portabilidade dos dados.</li>
                <li>Obter informações sobre o compartilhamento de dados.</li>
              </ul>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>8. Segurança</h2>
              <p>Adotamos medidas técnicas e organizacionais para proteger seus dados pessoais contra acessos não autorizados, uso indevido, perda ou destruição, incluindo criptografia em trânsito (HTTPS/TLS), controle de acesso baseado em funções e armazenamento em infraestrutura com certificações de segurança.</p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>9. Retenção de dados</h2>
              <p>Os dados pessoais são armazenados pelo tempo necessário para cumprir as finalidades descritas nesta política ou conforme exigido por lei. Dados fiscais são mantidos pelo prazo legal de 5 anos.</p>
            </div>

            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>10. Contato</h2>
              <p>Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados pessoais, entre em contato:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li><strong>E-mail:</strong> adm@pousinox.com.br</li>
                <li><strong>Telefone:</strong> (35) 3423-8994</li>
                <li><strong>Endereço:</strong> Av. Antonio Mariosa, 4545, São Geraldo, Pouso Alegre/MG, CEP 37550-000</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
