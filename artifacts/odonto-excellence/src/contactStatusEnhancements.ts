import './contactStatusEnhancements.css';

type Tone = 'green' | 'red' | 'yellow' | 'blue';

const TONE_CLASSES = ['cg-tone-green', 'cg-tone-red', 'cg-tone-yellow', 'cg-tone-blue'];

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toneFor(status: string, outcome = '', note = ''): Tone {
  const joined = normalize(`${status} ${outcome}`);
  if (joined.includes('efetivado') || joined.includes('agendado')) return 'green';
  if (joined.includes('numero incorreto') || joined.includes('nao tem interesse') || joined.includes('sem interesse')) return 'red';
  if (joined.includes('aguardando') || joined.includes('pendente') || joined.includes('enviado mensagem') || normalize(note).includes('pendente')) return 'yellow';
  return 'blue';
}

function normalizeWhatsAppPhone(raw: string) {
  let digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length === 12 || digits.length === 13 ? digits : '';
}

function messageFor(name: string, status: string, outcome = '') {
  const firstName = name.trim().split(/\s+/)[0] || '';
  const greetingName = firstName ? `, ${firstName}` : '';
  const state = normalize(`${status} ${outcome}`);

  if (state.includes('efetivado')) {
    return `Olá${greetingName}! Tudo bem? Aqui é da Odonto Excellence. Estou entrando em contato para dar continuidade ao seu atendimento. Se precisar falar com a nossa equipe ou tiver alguma dúvida, pode responder por aqui.`;
  }

  if (state.includes('agendado')) {
    return `Olá${greetingName}! Tudo bem? Aqui é da Odonto Excellence. Estou passando para confirmar sua avaliação odontológica. Se precisar ajustar o horário ou tiver alguma dúvida antes da avaliação, pode falar com a gente por aqui.`;
  }

  return `Bom dia${greetingName}, tudo bem?\n\nAqui é da Odonto Excellence. Você participou de uma ação externa da nossa clínica e deixou seu contato para agendarmos uma avaliação odontológica gratuita e sem compromisso.\n\nÉ uma ótima oportunidade para verificar como está sua saúde bucal, tirar dúvidas e conhecer melhor nossa clínica e nossos profissionais.\n\nAtendemos de segunda a sexta, das 09h às 20h, e aos sábados, das 09h às 17h.\n\nPara eu já separar as melhores opções para você, me diga: fica melhor pela manhã, à tarde ou à noite? Assim já te envio os horários disponíveis e deixamos sua avaliação agendada.`;
}

function whatsappIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.6Z"/><path d="M8.2 8.1c.2-.5.5-.5.8-.5h.4c.2 0 .4.1.5.4l.8 1.8c.1.3 0 .5-.1.7l-.6.8c-.1.1-.2.3 0 .6.6 1 1.5 1.9 2.6 2.5.3.2.5.1.7 0l.8-.9c.2-.2.4-.3.7-.2l1.8.9c.3.1.4.3.4.5 0 .4-.2 1.2-.8 1.7-.6.5-1.4.7-2.3.5-1.4-.3-3.2-1.1-4.9-2.7-1.4-1.4-2.4-3.1-2.7-4.5-.2-.8 0-1.3.1-1.6Z"/></svg>';
}

function buildWhatsAppLink(phoneRaw: string, name: string, status: string, outcome = '', mobile = false) {
  const phone = normalizeWhatsAppPhone(phoneRaw);
  if (!phone || normalize(status).includes('numero incorreto')) return null;
  const link = document.createElement('a');
  link.className = `cg-whatsapp-button ${mobile ? 'cg-whatsapp-mobile' : 'cg-whatsapp-desktop'}`;
  link.href = `https://wa.me/${phone}?text=${encodeURIComponent(messageFor(name, status, outcome))}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = `Abrir WhatsApp de ${name}`;
  link.setAttribute('aria-label', `Abrir WhatsApp de ${name} com mensagem pronta`);
  link.innerHTML = `${whatsappIcon()}${mobile ? '<span>WhatsApp</span>' : ''}`;
  return link;
}

function applyTone(element: HTMLElement, tone: Tone) {
  element.classList.remove(...TONE_CLASSES);
  element.classList.add(`cg-tone-${tone}`);
}

function enhanceDesktopRows() {
  document.querySelectorAll<HTMLElement>('.mg-table-row').forEach((row) => {
    const cells = Array.from(row.children) as HTMLElement[];
    if (cells.length < 9) return;
    const name = cells[1]?.querySelector('b')?.textContent?.trim() || 'Contato';
    const phoneRaw = cells[2]?.textContent?.trim() || '';
    const note = cells[4]?.textContent?.trim() || '';
    const statusSelect = row.querySelector<HTMLSelectElement>('.mg-status');
    const status = statusSelect?.value || '';
    const outcome = cells[6]?.textContent?.trim() || '';
    applyTone(row, toneFor(status, outcome, note));

    const actions = row.querySelector<HTMLElement>('.mg-row-actions');
    if (!actions) return;
    const existing = actions.querySelector<HTMLAnchorElement>('.cg-whatsapp-desktop');
    const next = buildWhatsAppLink(phoneRaw, name, status, outcome, false);
    if (!next) {
      existing?.remove();
      return;
    }
    if (existing?.href === next.href) return;
    existing?.remove();
    actions.prepend(next);
  });
}

function enhanceMobileCards() {
  document.querySelectorAll<HTMLElement>('.street-lead-card').forEach((card) => {
    const name = card.querySelector('h3')?.textContent?.trim() || 'Contato';
    const status = card.querySelector('.street-status')?.textContent?.trim() || '';
    const note = card.querySelector('.street-expanded-details p')?.textContent?.trim() || '';
    applyTone(card, toneFor(status, '', note));

    const phoneText = card.querySelector('.street-meta-line span')?.textContent?.trim() || '';
    const actions = card.querySelector<HTMLElement>('.street-lead-actions');
    if (!actions) return;
    const existing = actions.querySelector<HTMLAnchorElement>('.cg-whatsapp-mobile');
    const next = buildWhatsAppLink(phoneText, name, status, '', true);
    if (!next) {
      existing?.remove();
      return;
    }
    if (existing?.href === next.href) return;
    existing?.remove();
    const scheduleButton = actions.querySelector('button');
    if (scheduleButton) actions.insertBefore(next, scheduleButton);
    else actions.append(next);
  });
}

let frame = 0;
function scheduleEnhancement() {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    enhanceDesktopRows();
    enhanceMobileCards();
  });
}

export function installContactStatusEnhancements() {
  const marker = window as typeof window & { __contactStatusEnhancements?: boolean };
  if (marker.__contactStatusEnhancements) return;
  marker.__contactStatusEnhancements = true;

  scheduleEnhancement();
  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', scheduleEnhancement, true);
  window.addEventListener('controle-location-change', scheduleEnhancement);
}
