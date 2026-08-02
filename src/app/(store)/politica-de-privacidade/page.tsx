import { LegalPage, LegalSection } from "@/components/store/LegalPage";
import { storeConfig } from "@/lib/store-config";

export const metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  const nome = storeConfig.legalName || storeConfig.name;
  const cnpj = storeConfig.cnpj ? ` (CNPJ ${storeConfig.cnpj})` : "";

  return (
    <LegalPage title="Política de Privacidade" updatedAt="Julho de 2026">
      <p>
        Esta Política de Privacidade descreve como a <strong>{nome}</strong>
        {cnpj} coleta, usa, armazena e protege os dados pessoais dos usuários da
        loja <strong>{storeConfig.name}</strong>, em conformidade com a Lei Geral
        de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
      </p>

      <LegalSection n={1} title="Dados que coletamos" />
      <p>Coletamos os seguintes dados, fornecidos por você ou gerados no uso da loja:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Cadastro:</strong> nome, e-mail e senha (armazenada de forma criptografada).</li>
        <li><strong>Compra e entrega:</strong> CPF, telefone, endereço de entrega e CEP.</li>
        <li><strong>Pedidos:</strong> histórico de compras, itens, valores e status.</li>
        <li><strong>Pagamento:</strong> processado diretamente pelo Mercado Pago — não armazenamos números de cartão em nossos servidores.</li>
        <li><strong>Navegação:</strong> dados técnicos como endereço IP e cookies essenciais ao funcionamento (carrinho, sessão de login).</li>
      </ul>

      <LegalSection n={2} title="Para que usamos seus dados" />
      <ul className="list-disc space-y-1 pl-5">
        <li>Processar e entregar seus pedidos;</li>
        <li>Calcular frete e emitir etiquetas de envio;</li>
        <li>Processar pagamentos com segurança;</li>
        <li>Comunicar o status do pedido (confirmação, envio, entrega);</li>
        <li>Oferecer suporte e atendimento;</li>
        <li>Cumprir obrigações legais, fiscais e de defesa do consumidor.</li>
      </ul>

      <LegalSection n={3} title="Base legal (LGPD)" />
      <p>
        Tratamos seus dados com base na <strong>execução do contrato</strong> de
        compra e venda, no <strong>cumprimento de obrigação legal</strong>, e, quando
        aplicável, no seu <strong>consentimento</strong>.
      </p>

      <LegalSection n={4} title="Compartilhamento de dados" />
      <p>
        Compartilhamos apenas o necessário para concluir sua compra, com
        parceiros que também seguem a LGPD:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Mercado Pago</strong> — processamento de pagamentos;</li>
        <li><strong>Melhor Envio / Correios / transportadoras</strong> — cálculo de frete e entrega;</li>
        <li><strong>Autoridades</strong> — quando exigido por lei ou ordem judicial.</li>
      </ul>
      <p>Não vendemos nem alugamos seus dados pessoais a terceiros.</p>

      <LegalSection n={5} title="Seus direitos" />
      <p>Nos termos do art. 18 da LGPD, você pode a qualquer momento:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Confirmar a existência e acessar seus dados;</li>
        <li>Corrigir dados incompletos ou desatualizados;</li>
        <li>Solicitar a exclusão dos dados (respeitadas as obrigações legais de guarda);</li>
        <li>Solicitar a portabilidade;</li>
        <li>Revogar o consentimento.</li>
      </ul>
      <p>
        Para exercer seus direitos, entre em contato pelo e-mail{" "}
        <a href={`mailto:${storeConfig.contactEmail}`} className="text-accent underline underline-offset-2">
          {storeConfig.contactEmail}
        </a>.
      </p>

      <LegalSection n={6} title="Cookies" />
      <p>
        Utilizamos cookies essenciais para o funcionamento da loja (manter você
        logado e guardar seu carrinho). Você pode gerenciá-los nas configurações
        do seu navegador, mas alguns recursos podem deixar de funcionar.
      </p>

      <LegalSection n={7} title="Segurança e retenção" />
      <p>
        Adotamos medidas de segurança para proteger seus dados (senhas
        criptografadas, conexão HTTPS, controle de acesso). Mantemos os dados
        apenas pelo tempo necessário às finalidades acima e às obrigações legais
        (ex.: fiscais).
      </p>

      <LegalSection n={8} title="Contato" />
      <p>
        Dúvidas sobre esta política ou sobre seus dados? Fale com o encarregado de
        dados pelo e-mail{" "}
        <a href={`mailto:${storeConfig.contactEmail}`} className="text-accent underline underline-offset-2">
          {storeConfig.contactEmail}
        </a>
        {storeConfig.legalAddress ? `, ou pelo endereço ${storeConfig.legalAddress}` : ""}.
      </p>
    </LegalPage>
  );
}
