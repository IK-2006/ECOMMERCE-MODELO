import { LegalPage, LegalSection } from "@/components/store/LegalPage";
import { storeConfig } from "@/lib/store-config";

export const metadata = { title: "Trocas e Devoluções" };

export default function ReturnsPage() {
  return (
    <LegalPage title="Trocas e Devoluções" updatedAt="Julho de 2026">
      <p>
        Queremos que você ame a sua peça. Se algo não sair como esperado, veja
        abaixo como funcionam as trocas e devoluções na{" "}
        <strong>{storeConfig.name}</strong>, em conformidade com o Código de
        Defesa do Consumidor (Lei nº 8.078/1990).
      </p>

      <LegalSection n={1} title="Direito de arrependimento (7 dias)" />
      <p>
        Compras feitas pela internet têm o <strong>direito de arrependimento</strong>:
        você pode desistir da compra em até <strong>7 (sete) dias corridos</strong>
        após o recebimento do produto, sem necessidade de justificativa (art. 49
        do CDC). Nesse caso, o valor pago é <strong>integralmente restituído</strong>,
        incluindo o frete.
      </p>

      <LegalSection n={2} title="Troca por tamanho ou preferência" />
      <p>
        Você pode solicitar a troca por outro tamanho, cor ou modelo em até
        <strong> 7 dias corridos</strong> após o recebimento, desde que a peça esteja
        nas condições descritas abaixo.
      </p>

      <LegalSection n={3} title="Condições da peça" />
      <p>Para troca ou devolução, o produto deve estar:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Sem uso, sem sinais de lavagem, perfume ou maquiagem;</li>
        <li>Com todas as etiquetas e lacres originais;</li>
        <li>Na embalagem original, acompanhado da nota/recibo.</li>
      </ul>
      <p className="text-xs text-zinc-500">
        Por questões de higiene, peças íntimas, biquínis e maiôs só podem ser
        trocados se o lacre de proteção estiver intacto.
      </p>

      <LegalSection n={4} title="Produto com defeito" />
      <p>
        Recebeu uma peça com defeito de fabricação? Você tem até{" "}
        <strong>30 dias</strong> (art. 26 do CDC) para nos comunicar. Após
        avaliação, faremos a troca por uma peça igual, a correção do defeito ou a
        restituição do valor, conforme sua preferência — sem custo de frete para
        você.
      </p>

      <LegalSection n={5} title="Como solicitar" />
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Entre em contato pelo e-mail{" "}
          <a href={`mailto:${storeConfig.contactEmail}`} className="text-accent underline underline-offset-2">
            {storeConfig.contactEmail}
          </a>{" "}
          informando o número do pedido e o motivo;
        </li>
        <li>Nossa equipe orienta o envio ou a retirada da peça;</li>
        <li>Assim que recebermos e conferirmos o produto, processamos a troca ou o reembolso.</li>
      </ol>

      <LegalSection n={6} title="Reembolso" />
      <p>
        O reembolso é feito pelo mesmo meio de pagamento da compra: em compras no
        Pix ou boleto, por transferência/estorno; no cartão de crédito, o estorno
        aparece na fatura conforme o prazo da operadora. O prazo começa a contar
        após o recebimento e a conferência da peça devolvida.
      </p>

      <LegalSection n={7} title="Frete da devolução" />
      <p>
        Nos casos de <strong>arrependimento</strong> ou <strong>defeito</strong>, o
        frete de devolução é por nossa conta. Em trocas por preferência (tamanho,
        cor), o frete de reenvio pode ser combinado no atendimento.
      </p>
    </LegalPage>
  );
}
