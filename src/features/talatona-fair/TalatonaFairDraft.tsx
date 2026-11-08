import SocialParticipation from "@/features/social-initiatives/SocialParticipation";
import { socialInitiativesEnabled } from "@/features/social-initiatives/api";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import FairAddressStep from "./FairAddressStep";
import { Award, CalendarDays, MapPin, Users } from "lucide-react";
import YamilookLogo from "@/components/brand/YamilookLogo";
import { Button } from "@/components/ui/button";
import { condominiumGroups } from "./condominiums";

export default function TalatonaFairDraft() {
  const { user } = useAuth();
  return <FairDraftContent key={user?.id ?? "visitor"} />;
}

function FairDraftContent() {
  const [condominium, setCondominium] = useState("");

  return (
    <main lang="pt-AO" className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-14">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <YamilookLogo size="sm" showTagline={false} animate={false} />
          <span className="rounded-full border px-3 py-1 text-xs font-medium">{socialInitiativesEnabled ? "Iniciativa solidária" : "Pré-visualização"}</span>
        </div>

        <header className="space-y-4 rounded-2xl bg-emerald-950 p-6 text-white sm:p-9">
          <p className="text-sm font-semibold text-amber-300">Talatona · Luanda</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Feira de Natal Solidário</h1>
          <p>Este Natal, junte-se aos seus vizinhos numa feira da comunidade de Talatona.</p>
          <p className="flex items-center gap-2 text-sm text-emerald-100">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            5 e 6 de Dezembro de 2026
          </p>
          <p className="font-semibold">Entrada livre</p>
        </header>

        <section aria-labelledby="fair-details" className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="fair-details" className="text-xl font-semibold">Informações práticas</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="font-medium">Recinto exacto</dt><dd>Por concluir</dd></div>
            <div><dt className="font-medium">Horário de sábado, 5 de Dezembro</dt><dd>Por concluir</dd></div>
            <div><dt className="font-medium">Horário de domingo, 6 de Dezembro</dt><dd>Por concluir</dd></div>
            <div><dt className="font-medium">Prazo de inscrição</dt><dd>Por concluir</dd></div>
            <div><dt className="font-medium">Limite de participantes</dt><dd>Por concluir</dd></div>
          </dl>
        </section>

        <section aria-labelledby="fair-programme" className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="fair-programme" className="text-xl font-semibold">Programa da feira</h2>
          <div className="space-y-2 text-sm">
            <h3 className="font-semibold">Sábado, 5 de Dezembro</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Abertura oficial e recepção dos convidados, com discurso da Primeira Secretária sobre o carácter social, inclusivo e apartidário da feira.</li>
              <li>Visita guiada a todos os expositores, seguida de interacção livre com os visitantes.</li>
              <li>Actuação musical, apresentação de um grupo folclórico e animação com DJ.</li>
              <li>Dez minutos de microfone aberto por expositor para divulgar o seu trabalho.</li>
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <h3 className="font-semibold">Domingo, 6 de Dezembro</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Abertura em formato livre.</li>
              <li>Actuação musical, grupo folclórico, DJ, palhaço, dança, jogos, brincadeiras e roda de samba.</li>
              <li>Dez minutos de microfone aberto por expositor para divulgar o seu trabalho.</li>
              <li>Entrega de 1.500 brinquedos destinados exclusivamente às 1.100 crianças convidadas, identificadas com pulseiras.</li>
            </ul>
          </div>
          <p className="text-sm">
            Os visitantes poderão doar voluntariamente massa, arroz, açúcar, vestuário ou brinquedos
            para entrega posterior a um lar de acolhimento.
          </p>
        </section>

        <section aria-labelledby="fair-exhibitors" className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="fair-exhibitors" className="text-xl font-semibold">Participação de expositores</h2>
          <dl className="space-y-3 text-sm">
            <div><dt>Pintores e categoria de menor custo</dt><dd className="font-semibold">5.000,00 Kz</dd></div>
            <div><dt>Expositores diversos com tenda da organização</dt><dd className="font-semibold">20.000,00 Kz por dia</dd></div>
            <div><dt>Expositores diversos com tenda própria</dt><dd className="font-semibold">15.000,00 Kz</dd></div>
            <div><dt>Restauração com tenda própria ou da organização</dt><dd className="font-semibold">30.000,00 Kz por dia</dd></div>
          </dl>
          <div className="space-y-2 text-sm">
            <h3 className="font-semibold">Pagamento da restauração</h3>
            <p>60.000,00 Kz pelos dois dias, em três parcelas.</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>30.000,00 Kz até 20 de Novembro de 2026.</li>
              <li>15.000,00 Kz até às 20h00, em data a confirmar.</li>
              <li>15.000,00 Kz no acto de encerramento da feira.</li>
            </ol>
            <p>Os restantes expositores devem pagar 100% da reserva até 20 de Novembro de 2026. Em caso de atraso, poderão ser substituídos.</p>
          </div>
        </section>

        {socialInitiativesEnabled ? <SocialParticipation /> : <section aria-labelledby="fair-address" className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="fair-address" className="flex items-center gap-2 text-xl font-semibold">
            <MapPin className="h-5 w-5 shrink-0" aria-hidden="true" />
            Escolha onde mora
          </h2>
          <div className="space-y-2">
            <label htmlFor="fair-condominium" className="block text-sm font-medium">Condomínio</label>
            <select
              id="fair-condominium"
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              value={condominium}
              onChange={(event) => setCondominium(event.target.value)}
            >
              <option value="">Seleccione uma opção</option>
              {condominiumGroups.map(({ label, names }) => (
                <optgroup key={label} label={label}>
                  {names.map((name) => <option key={name} value={name}>{name}</option>)}
                </optgroup>
              ))}
              <option value="other">O meu condomínio não está na lista</option>
              <option value="none">Não moro num condomínio</option>
            </select>
          </div>
          <p className="text-sm text-muted-foreground">
            Quando as inscrições abrirem, crie um endereço AFROLOC ou associe o que já tem para concluir a sua adesão na YAMILOOK.
          </p>
          <Button asChild variant="outline">
            <a href="https://www.afroloc.ao/">Abrir o AFROLOC</a>
          </Button>
          <p className="text-xs text-muted-foreground">A escolha do condomínio nesta pré-visualização fica apenas no ecrã.</p>
          {condominium && <FairAddressStep />}
        </section>}

        <section aria-labelledby="fair-neighbours" className="space-y-3 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="fair-neighbours" className="flex items-center gap-2 text-xl font-semibold">
            <Users className="h-5 w-5 shrink-0" aria-hidden="true" />
            Convide até 5 vizinhos
          </h2>
          <p className="text-sm">
            Após a confirmação do seu endereço, poderá convidar até cinco pessoas do mesmo condomínio ou das proximidades.
            Cada convidado fará a sua própria adesão com o seu endereço AFROLOC.
          </p>
          {!socialInitiativesEnabled && <p className="text-sm font-medium">Inscrições e convites ainda por abrir.</p>}
        </section>

        <section aria-labelledby="fair-ambassador" className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="fair-ambassador" className="flex items-center gap-2 text-xl font-semibold">
            <Award className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            Embaixador Social YAMILOOK
          </h2>
          <p className="text-sm">
            Cumpra as metas de uma iniciativa e conquiste a sua distinção de Embaixador Social.
            Cada iniciativa terá a sua insígnia, atribuída uma vez a cada participante elegível.
          </p>
          <p className="text-sm text-muted-foreground">
            As suas iniciativas, o progresso das metas e as distinções conquistadas farão parte
            do seu perfil. Cada nova distinção soma ao total acumulado.
          </p>
          {!socialInitiativesEnabled && <><details className="rounded-xl border p-4 text-sm">
            <summary className="cursor-pointer font-medium">Proposta de meta para esta feira</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Ter o endereço AFROLOC associado e confirmado.</li>
              <li>Ter a sua participação na feira confirmada pela organização.</li>
              <li>Mobilizar cinco vizinhos elegíveis que concluam a adesão.</li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              A organização confirmará estas metas e o prazo antes da abertura da iniciativa.
              Pode participar na feira e acompanhar o seu progresso até conquistar a distinção.
            </p>
          </details>
          <div className="space-y-2 rounded-xl bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Exemplo de perfil após validação</p>
            <p className="font-semibold">Embaixador Social · 1 distinção</p>
            <p className="text-sm">Feira de Natal Solidário · Metas cumpridas</p>
            <p className="text-xs text-muted-foreground">1 iniciativa participada · 1 distinção conquistada</p>
          </div></>}
        </section>
      </div>
    </main>
  );
}
