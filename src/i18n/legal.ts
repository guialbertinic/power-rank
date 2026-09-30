import type { Lang } from './index';

/**
 * Termos de uso e política de privacidade (português e inglês). Texto longo e estruturado: fica aqui, e não em
 * pt.ts/en.ts. `{email}` vira o link do contato. Mudou uma regra (ex: retenção do IP em server/access.ts,
 * idade mínima, 18+)? Atualize o texto e a data `UPDATED`.
 * Não é aconselhamento jurídico: validar com advogado antes de monetizar.
 */

/** Canal de contato (LGPD, remoção de imagem, dúvidas). TODO: trocar pelo e-mail definitivo antes de divulgar. */
export const CONTACT_EMAIL = 'contato@naotenhocontatoainda.com';
export const UPDATED = '2026-09-29';

export type LegalDoc = 'terms' | 'privacy';

export interface LegalSection {
  title: string;
  /** Cada item: um parágrafo (string) ou uma lista (string[]). */
  body: (string | string[])[];
}

export interface LegalText {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const TERMS_PT: LegalText = {
  title: 'Termos de uso',
  intro:
    'Estes termos valem para quem joga o Power Rank. Ao escolher um nick e jogar, você concorda com eles e com a Política de privacidade.',
  sections: [
    {
      title: 'O jogo',
      body: [
        'O Power Rank é um jogo gratuito de entretenimento: você ordena personagens de animes e games pelo "nível de poder". Os níveis de poder são uma opinião nossa, feita para a brincadeira, e não uma verdade oficial das obras.',
      ],
    },
    {
      title: 'Idade',
      body: [
        'Para jogar, você precisa ter pelo menos 13 anos. O cassino (caça-níquel) e a Mystery Box são só para maiores de 18 anos: para entrar, a conta declara ter 18 anos ou mais. Declarar uma idade falsa viola estes termos.',
      ],
    },
    {
      title: 'Conta e nick',
      body: [
        [
          'Você pode jogar como convidado (sem conta) ou criar uma conta com nick e senha. Guarde sua senha: ela é a única forma de entrar em outro dispositivo.',
          'Nicks ofensivos, que imitam outras pessoas ou outras contas podem ser trocados ou removidos.',
          'Você é responsável pelo que acontece na sua conta.',
        ],
      ],
    },
    {
      title: 'Moedas e itens',
      body: [
        [
          'As moedas são virtuais e não têm valor em dinheiro. Não podem ser compradas, vendidas, trocadas por dinheiro ou transferidas para outra conta.',
          'Os itens da loja e da Mystery Box são apenas cosméticos (cores, molduras, títulos, avatares) e não dão vantagem no jogo.',
          'Podemos ajustar ou zerar saldos e itens em caso de erro, abuso ou mudança nas regras do jogo.',
        ],
      ],
    },
    {
      title: 'Cassino e Mystery Box',
      body: [
        'Usam apenas as moedas do jogo. Não há aposta com dinheiro real nem prêmio com valor real, e não é possível comprar moedas. Os sorteios são feitos no servidor.',
      ],
    },
    {
      title: 'Regras de conduta',
      body: [
        'É proibido:',
        [
          'usar bots, scripts ou qualquer automação para jogar;',
          'explorar falhas do jogo ou do servidor;',
          'criar várias contas para manipular o ranking ou juntar moedas;',
          'atacar, sobrecarregar ou tentar invadir o serviço;',
          'usar o jogo para ofender ou assediar outras pessoas.',
        ],
        'Quem descumprir pode ter partidas removidas do ranking, moedas e itens zerados e a conta bloqueada. Para investigar esses casos, guardamos registros de acesso (ver Política de privacidade).',
      ],
    },
    {
      title: 'Personagens e imagens',
      body: [
        'Os personagens, nomes e imagens pertencem aos seus respectivos donos. O Power Rank é um projeto de fã, sem ligação com esses donos. Se você é titular de direitos e quer que uma imagem ou personagem seja removido, escreva para {email}.',
      ],
    },
    {
      title: 'Disponibilidade',
      body: [
        'O jogo é oferecido como está. Ele pode mudar, ficar fora do ar ou ser encerrado a qualquer momento, e os rankings podem ser reiniciados.',
      ],
    },
    {
      title: 'Mudanças nestes termos',
      body: [
        'Podemos atualizar estes termos; a data da última atualização fica no topo. Continuar jogando depois de uma mudança significa concordar com a nova versão.',
      ],
    },
    { title: 'Contato', body: ['Dúvidas ou pedidos: {email}.'] },
  ],
};

const TERMS_EN: LegalText = {
  title: 'Terms of use',
  intro:
    'These terms apply to everyone who plays Power Rank. By choosing a nick and playing, you agree to them and to the Privacy policy.',
  sections: [
    {
      title: 'The game',
      body: [
        'Power Rank is a free entertainment game: you rank anime and game characters by "power level". Power levels are our opinion, made for fun, not an official fact from the original works.',
      ],
    },
    {
      title: 'Age',
      body: [
        'You must be at least 13 years old to play. The casino (slot machine) and the Mystery Box are for adults only (18+): to enter, the account declares being 18 or older. Declaring a false age violates these terms.',
      ],
    },
    {
      title: 'Account and nick',
      body: [
        [
          'You can play as a guest (no account) or create an account with a nick and password. Keep your password: it is the only way to sign in on another device.',
          'Nicks that are offensive or impersonate other people or accounts may be changed or removed.',
          'You are responsible for what happens on your account.',
        ],
      ],
    },
    {
      title: 'Coins and items',
      body: [
        [
          'Coins are virtual and have no monetary value. They cannot be bought, sold, exchanged for money or transferred to another account.',
          'Shop and Mystery Box items are cosmetic only (colors, frames, titles, avatars) and give no gameplay advantage.',
          'We may adjust or reset balances and items in case of errors, abuse or changes to the game rules.',
        ],
      ],
    },
    {
      title: 'Casino and Mystery Box',
      body: [
        'They use only in-game coins. There is no real-money betting, no prize with real value, and coins cannot be purchased. Draws happen on the server.',
      ],
    },
    {
      title: 'Code of conduct',
      body: [
        'You may not:',
        [
          'use bots, scripts or any automation to play;',
          'exploit bugs in the game or the server;',
          'create multiple accounts to manipulate the ranking or farm coins;',
          'attack, overload or try to break into the service;',
          'use the game to offend or harass other people.',
        ],
        'Violations may lead to games removed from the ranking, coins and items reset and the account blocked. To investigate these cases, we keep access logs (see the Privacy policy).',
      ],
    },
    {
      title: 'Characters and images',
      body: [
        'Characters, names and images belong to their respective owners. Power Rank is a fan project, not affiliated with them. If you are a rights holder and want an image or character removed, write to {email}.',
      ],
    },
    {
      title: 'Availability',
      body: [
        'The game is provided as is. It may change, go offline or shut down at any time, and rankings may be reset.',
      ],
    },
    {
      title: 'Changes to these terms',
      body: [
        'We may update these terms; the last update date is shown at the top. Continuing to play after a change means you agree to the new version.',
      ],
    },
    { title: 'Contact', body: ['Questions or requests: {email}.'] },
  ],
};

const PRIVACY_PT: LegalText = {
  title: 'Política de privacidade',
  intro:
    'Esta política explica quais dados o Power Rank guarda, para quê e por quanto tempo, de acordo com a Lei Geral de Proteção de Dados (LGPD).',
  sections: [
    {
      title: 'Quem é o responsável',
      body: ['O Power Rank é mantido por um desenvolvedor independente. Para qualquer assunto sobre seus dados: {email}.'],
    },
    {
      title: 'Dados que guardamos',
      body: [
        [
          'Nick, e a senha da conta apenas em forma de hash (não dá para ler a senha).',
          'Partidas: personagens sorteados, suas posições, pontuação, tempo e data.',
          'Moedas, itens, visual equipado e histórico do cassino e da Mystery Box.',
          'A data em que a conta declarou ter 18 anos ou mais.',
          'Registros de acesso: endereço IP, país aproximado e navegador (user agent), com data e hora, quando você cria a conta, entra nela (inclusive com senha errada), envia uma partida ou entra numa sala da party.',
        ],
        'Não pedimos nome real, e-mail, telefone nem documento.',
      ],
    },
    {
      title: 'No seu navegador',
      body: [
        'O jogo guarda no armazenamento local do navegador o seu nick, o acesso à conta, o idioma e a categoria escolhida. Não usamos cookies de publicidade nem de rastreamento. Na criação de conta, o Cloudflare Turnstile verifica se você não é um robô.',
      ],
    },
    {
      title: 'Para que usamos',
      body: [
        [
          'Fazer o jogo funcionar: conta, ranking, moedas, loja e party (execução do serviço, art. 7º, V da LGPD).',
          'Segurança e prevenção de abuso e trapaça, com os registros de acesso (legítimo interesse, art. 7º, IX).',
          'Entender como o jogo é usado e equilibrar pontuação e economia.',
        ],
      ],
    },
    {
      title: 'O que é público',
      body: [
        'Seu nick, visual (avatar, cor, moldura, título), pontuação e tempo aparecem no ranking e para quem estiver na mesma sala da party. O IP e os demais registros de acesso nunca aparecem para outros jogadores.',
      ],
    },
    {
      title: 'Com quem compartilhamos',
      body: [
        'Não vendemos seus dados. O jogo roda na Cloudflare (hospedagem, banco de dados e Turnstile), que trata os dados em nosso nome. Podemos fornecer dados a autoridades quando a lei exigir.',
      ],
    },
    {
      title: 'Por quanto tempo',
      body: [
        [
          'Registros de acesso (IP): 90 dias, e depois são apagados automaticamente.',
          'Conta, partidas e itens: enquanto a conta existir ou até você pedir a exclusão.',
        ],
      ],
    },
    {
      title: 'Seus direitos',
      body: [
        'Você pode pedir para confirmar quais dados temos, acessar, corrigir ou excluir seus dados e sua conta, entre outros direitos da LGPD. Escreva para {email} informando o nick; podemos pedir uma confirmação de que a conta é sua.',
      ],
    },
    {
      title: 'Crianças e adolescentes',
      body: [
        'O jogo é para maiores de 13 anos, e o cassino e a Mystery Box, para maiores de 18. Se soubermos que uma conta é de alguém com menos de 13 anos, ela será excluída.',
      ],
    },
    {
      title: 'Segurança',
      body: [
        'A conexão é sempre criptografada (HTTPS), as senhas são guardadas com hash (PBKDF2) e o acesso ao banco de dados é restrito.',
      ],
    },
    {
      title: 'Mudanças nesta política',
      body: ['Se esta política mudar, a data de atualização no topo muda junto.'],
    },
  ],
};

const PRIVACY_EN: LegalText = {
  title: 'Privacy policy',
  intro:
    'This policy explains what data Power Rank keeps, why and for how long, in line with the Brazilian General Data Protection Law (LGPD).',
  sections: [
    {
      title: 'Who is responsible',
      body: ['Power Rank is run by an independent developer. For anything about your data: {email}.'],
    },
    {
      title: 'Data we keep',
      body: [
        [
          'Nick, and the account password only as a hash (the password cannot be read).',
          'Games: characters drawn, your placements, score, time and date.',
          'Coins, items, equipped look and casino and Mystery Box history.',
          'The date the account declared being 18 or older.',
          'Access logs: IP address, approximate country and browser (user agent), with date and time, when you create an account, sign in (including wrong passwords), submit a game or join a party room.',
        ],
        'We do not ask for your real name, email, phone number or ID.',
      ],
    },
    {
      title: 'In your browser',
      body: [
        'The game stores your nick, account access, language and chosen category in the browser’s local storage. We do not use advertising or tracking cookies. When you create an account, Cloudflare Turnstile checks that you are not a robot.',
      ],
    },
    {
      title: 'How we use it',
      body: [
        [
          'To run the game: account, ranking, coins, shop and party (performance of the service, LGPD art. 7, V).',
          'Security and prevention of abuse and cheating, using the access logs (legitimate interest, art. 7, IX).',
          'To understand how the game is used and balance scoring and the economy.',
        ],
      ],
    },
    {
      title: 'What is public',
      body: [
        'Your nick, look (avatar, color, frame, title), score and time appear in the ranking and to people in the same party room. Your IP and other access logs are never shown to other players.',
      ],
    },
    {
      title: 'Who we share it with',
      body: [
        'We do not sell your data. The game runs on Cloudflare (hosting, database and Turnstile), which processes data on our behalf. We may provide data to authorities when required by law.',
      ],
    },
    {
      title: 'How long we keep it',
      body: [
        [
          'Access logs (IP): 90 days, then deleted automatically.',
          'Account, games and items: while the account exists or until you ask for deletion.',
        ],
      ],
    },
    {
      title: 'Your rights',
      body: [
        'You can ask to confirm what data we hold, and to access, correct or delete your data and your account, among other LGPD rights. Write to {email} with your nick; we may ask you to confirm the account is yours.',
      ],
    },
    {
      title: 'Children and teenagers',
      body: [
        'The game is for ages 13 and up, and the casino and Mystery Box for 18 and up. If we learn that an account belongs to someone under 13, it will be deleted.',
      ],
    },
    {
      title: 'Security',
      body: [
        'The connection is always encrypted (HTTPS), passwords are stored hashed (PBKDF2) and access to the database is restricted.',
      ],
    },
    {
      title: 'Changes to this policy',
      body: ['If this policy changes, the update date at the top changes too.'],
    },
  ],
};

const TEXTS: Record<LegalDoc, Record<Lang, LegalText>> = {
  terms: { pt: TERMS_PT, en: TERMS_EN },
  privacy: { pt: PRIVACY_PT, en: PRIVACY_EN },
};

export function legalText(doc: LegalDoc, lang: Lang): LegalText {
  return TEXTS[doc][lang];
}
