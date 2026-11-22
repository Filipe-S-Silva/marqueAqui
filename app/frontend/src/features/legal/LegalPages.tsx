// MINUTA dos Termos e da Política de Privacidade (LGPD, Art. 9º). Revisar com advogado(a) antes de publicar
// e preencher o nome do responsável e o e-mail do canal (VITE_PRIVACY_EMAIL). Ao mudar o texto, atualize TERMS_VERSION no backend.
// Sem CNPJ, o controlador é a pessoa física responsável. Ao abrir a empresa, troque RESPONSIBLE pela razão social + CNPJ.
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';

const VERSION = '21/11/2026';
// Nome completo da pessoa física responsável (controlador). Não publique CPF aqui.
const RESPONSIBLE = '[preencher nome completo]';
export const PRIVACY_EMAIL = (import.meta.env.VITE_PRIVACY_EMAIL as string | undefined) || '[preencher VITE_PRIVACY_EMAIL]';

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen p-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4" aria-hidden /> Voltar ao início</Link></Button>
        <ThemeToggle />
      </div>
      <article className="mx-auto grid max-w-3xl gap-4 py-8 leading-relaxed [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        <Link to="/" className="text-xl"><BrandMark /></Link>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="text-sm text-muted-foreground">Versão de {VERSION}</p>
        {children}
      </article>
    </div>
  );
}

const Mail = () => <a className="font-semibold text-primary hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>;

export function PrivacyPage() {
  return (
    <LegalShell title="Política de Privacidade">
      <p>Esta política explica quais dados pessoais o MarqueAqui usa, para quê, por quanto tempo e como você exerce os seus direitos (Lei nº 13.709/2018, LGPD).</p>

      <h2>Quem trata os seus dados</h2>
      <p>O MarqueAqui é um projeto mantido por {RESPONSIBLE}, pessoa física responsável pelo tratamento dos dados das contas da plataforma (controlador). Cada salão ou barbearia é responsável pelos dados dos clientes que atende e pelos agendamentos feitos no balcão.</p>
      <p>Canal de privacidade: <Mail />. O responsável é agente de tratamento de pequeno porte (Resolução CD/ANPD nº 2/2022) e mantém este canal para atender os titulares.</p>

      <h2>Quais dados usamos e para quê</h2>
      <ul>
        <li><strong>Conta:</strong> nome, e-mail, telefone (opcional) e senha (guardada só de forma irreversível). Para criar a conta, entrar e falar com você. Base legal: execução de contrato (Art. 7º, V).</li>
        <li><strong>Agendamentos:</strong> serviço, profissional, data, horário, preço e o nome e o telefone de quem será atendido. Para reservar o horário e permitir que o estabelecimento atenda. Base legal: execução de contrato (Art. 7º, V).</li>
        <li><strong>Avaliações, feedbacks e chamados de suporte:</strong> o texto que você escrever. Não informe dados de saúde ou outros dados sensíveis nesses campos.</li>
        <li><strong>Profissionais e gestores:</strong> foto e descrição públicas, exibidas aos clientes na escolha do profissional.</li>
        <li><strong>Segurança e registros de acesso:</strong> endereço IP, navegador e data e hora de acesso. Para proteger as contas, limitar tentativas abusivas e cumprir a guarda de registros de acesso (Marco Civil da Internet, Art. 15; LGPD, Art. 7º, II e IX).</li>
      </ul>
      <p>Não usamos os seus dados para publicidade, não vendemos dados e não criamos perfis de comportamento.</p>

      <h2>Crianças e adolescentes</h2>
      <p>Só maiores de 18 anos criam conta. Menores são agendados pela conta de um responsável ou no balcão do estabelecimento, que registra apenas o necessário para o atendimento. Os dados de menores são tratados no seu melhor interesse (LGPD, Art. 14), sem publicidade nem perfilamento.</p>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>Com o estabelecimento em que você agenda: nome, telefone e dados do agendamento.</li>
        <li>Com fornecedores que operam a plataforma por nossa conta: hospedagem do site e da API, banco de dados e serviços de infraestrutura. Alguns podem armazenar dados fora do Brasil; nesses casos adotamos os mecanismos do Art. 33 da LGPD.</li>
        <li>Com autoridades, quando a lei ou uma ordem judicial exigir.</li>
      </ul>

      <h2>Por quanto tempo guardamos</h2>
      <ul>
        <li>Agendamentos concluídos, cancelados ou com falta: apagados 3 meses depois da data.</li>
        <li>Registros de acesso (IP, data e hora): 6 meses, por obrigação legal.</li>
        <li>Conta: enquanto estiver ativa. Contas sem acesso por 45 dias são desativadas. Ao excluir a conta, os dados pessoais são removidos ou anonimizados, salvo o que a lei obriga a guardar.</li>
      </ul>

      <h2>Seus direitos</h2>
      <p>Você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a exclusão ou a portabilidade, saber com quem compartilhamos e revogar consentimentos (LGPD, Art. 18). Na área “Meu perfil” você baixa uma cópia dos seus dados e exclui a conta. Para os demais pedidos, ou se você foi atendido no balcão sem conta, escreva para <Mail />. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2>Segurança</h2>
      <p>Usamos conexão criptografada (HTTPS), senhas com hash forte, sessões com expiração e controle de acesso por perfil. Se houver um incidente que possa causar risco relevante a você, avisaremos você e a ANPD nos prazos da Resolução CD/ANPD nº 15/2024.</p>

      <h2>Cookies e armazenamento no navegador</h2>
      <p>Usamos apenas um cookie essencial de sessão e guardamos no navegador a sua preferência de tema (claro ou escuro). Não usamos cookies de publicidade nem de análise.</p>

      <h2>Mudanças nesta política</h2>
      <p>Avisaremos na plataforma quando esta política mudar de forma relevante.</p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Termos de Uso">
      <p>Estes termos regem o uso do MarqueAqui, plataforma de agendamento para salões e barbearias mantida por {RESPONSIBLE}, pessoa física responsável pelo serviço.</p>
      <h2>Conta</h2>
      <ul>
        <li>Para criar uma conta é preciso ter 18 anos ou mais. Menores são agendados pela conta de um responsável.</li>
        <li>Você é responsável pelas informações que fornece e por manter a sua senha em sigilo.</li>
      </ul>
      <h2>Agendamentos</h2>
      <ul>
        <li>O horário reservado é um compromisso com o estabelecimento. Cancele pela plataforma se não puder comparecer.</li>
        <li>O serviço é prestado pelo estabelecimento, que define preços, duração e políticas de atendimento.</li>
      </ul>
      <h2>Uso adequado</h2>
      <p>Não use a plataforma para reservas falsas, para obter dados de outras pessoas ou para publicar conteúdo ofensivo em avaliações e chamados. Podemos desativar contas que violem estes termos.</p>
      <h2>Privacidade</h2>
      <p>O uso dos seus dados está descrito na <Link className="font-semibold text-primary hover:underline" to="/privacidade">Política de Privacidade</Link>. Dúvidas: <Mail />.</p>
      <h2>Exclusão da conta</h2>
      <p>Você pode excluir a sua conta a qualquer momento em “Meu perfil”.</p>
    </LegalShell>
  );
}
