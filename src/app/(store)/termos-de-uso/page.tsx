import { LegalPage, LegalSection } from "@/components/store/LegalPage";
import { storeConfig } from "@/lib/store-config";

export const metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  const nome = storeConfig.legalName || storeConfig.name;
  const cnpj = storeConfig.cnpj ? ` (CNPJ ${storeConfig.cnpj})` : "";

  return (
    <LegalPage title="Termos de Uso" updatedAt="Julho de 2026">
      <p>
        Estes Termos de Uso regem o acesso e a utilização da loja{" "}
        <strong>{storeConfig.name}</strong>, operada por <strong>{nome}</strong>
        {cnpj}. Ao usar o site e realizar compras, você declara ter lido e
        concordado com estas condições.
      </p>

      <LegalSection n={1} title="Cadastro e conta" />
      <p>
        Para comprar, você pode criar uma conta com dados verdadeiros e
        atualizados. Você é responsável por manter a confidencialidade da sua
        senha e por todas as atividades realizadas na sua conta. Recomendamos
        ativar a verificação em duas etapas quando disponível.
      </p>

      <LegalSection n={2} title="Produtos, preços e disponibilidade" />
      <p>
        Nos esforçamos para exibir informações, fotos e preços corretos. Podem
        ocorrer erros de digitação ou indisponibilidade de estoque; nesses casos,
        reservamo-nos o direito de cancelar o pedido e restituir integralmente
        eventual valor pago. As cores dos produtos podem variar levemente
        conforme a tela do dispositivo.
      </p>

      <LegalSection n={3} title="Pedidos e pagamento" />
      <p>
        O pedido é confirmado após a aprovação do pagamento pelo Mercado Pago
        (Pix, cartão de crédito ou boleto). Enquanto o pagamento não é aprovado,
        o pedido fica com status "Aguardando pagamento" e os itens podem não
        estar reservados.
      </p>

      <LegalSection n={4} title="Entrega e frete" />
      <p>
        O prazo e o valor do frete são calculados no checkout a partir do seu
        CEP. Os prazos são estimativas das transportadoras, contados em dias
        úteis após a confirmação do pagamento e o preparo do pedido. Também
        oferecemos, quando disponível, a opção de retirada na loja.
      </p>

      <LegalSection n={5} title="Trocas e devoluções" />
      <p>
        As condições de troca e devolução, incluindo o direito de arrependimento
        de 7 dias previsto no Código de Defesa do Consumidor, estão descritas na
        nossa{" "}
        <a href="/trocas-e-devolucoes" className="text-accent underline underline-offset-2">
          Política de Trocas e Devoluções
        </a>.
      </p>

      <LegalSection n={6} title="Uso adequado" />
      <p>É proibido usar a loja para fins ilícitos, tentar burlar sistemas de segurança, pagamento ou preço, ou reproduzir o conteúdo (textos, fotos, marca) sem autorização.</p>

      <LegalSection n={7} title="Propriedade intelectual" />
      <p>
        A marca <strong>{storeConfig.name}</strong>, o layout, os textos e as
        imagens do site são protegidos e não podem ser copiados sem autorização
        prévia por escrito.
      </p>

      <LegalSection n={8} title="Privacidade" />
      <p>
        O tratamento dos seus dados segue a nossa{" "}
        <a href="/politica-de-privacidade" className="text-accent underline underline-offset-2">
          Política de Privacidade
        </a>, em conformidade com a LGPD.
      </p>

      <LegalSection n={9} title="Alterações e foro" />
      <p>
        Podemos atualizar estes Termos a qualquer momento; a versão vigente é
        sempre a publicada nesta página. Fica eleito o foro do domicílio do
        consumidor para dirimir eventuais controvérsias.
      </p>

      <LegalSection n={10} title="Contato" />
      <p>
        Dúvidas? Fale conosco pelo e-mail{" "}
        <a href={`mailto:${storeConfig.contactEmail}`} className="text-accent underline underline-offset-2">
          {storeConfig.contactEmail}
        </a>.
      </p>
    </LegalPage>
  );
}
