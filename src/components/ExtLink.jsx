import { useLang } from '../hooks/useLang.jsx';

// Знешнія спасылкі — на рэсурсы са спісаў (у тэксце запісаў) і на крыніцу запісу (Медыязона, чые рэсурсы самі ў спісе
// матэрыялаў): перад першым пераходам за сесію — папярэджанне, далей адкрываюцца адразу.
const ACK = 'elist-links-ok';
let ackMem = false;
const acknowledged = () => { try { return ackMem || sessionStorage.getItem(ACK) === '1'; } catch { return ackMem; } };
const acknowledge = () => { ackMem = true; try { sessionStorage.setItem(ACK, '1'); } catch { /* ignore */ } };

/** Знешняя спасылка ў новай укладцы без рэферэра, з папярэджаннем перад першым пераходам за сесію. */
export default function ExtLink({ href, children, ...rest }) {
  const { t } = useLang();
  const onClick = (e) => {
    if (acknowledged()) return;
    e.preventDefault();
    if (!confirm(t.linkWarn)) return;
    acknowledge();
    open(e.currentTarget.href, '_blank', 'noopener,noreferrer');
  };
  return <a href={href} target="_blank" rel="noopener noreferrer nofollow" onClick={onClick} {...rest}>{children}</a>;
}
