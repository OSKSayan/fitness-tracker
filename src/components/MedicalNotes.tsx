import { update, useData } from '../store';
import { Notice } from './ui';

/** Короткое напоминание перед возвращением к нагрузкам после больницы. */
export function DoctorNotice() {
  const data = useData();
  if (data.settings.doctorAck) return null;
  return (
    <Notice tone="warn">
      <strong>Перед возвращением к нагрузкам</strong>
      <p>
        После больницы возвращайтесь к тренировкам постепенно и следуйте рекомендациям лечащего врача. Приложение — это дневник, оно не
        оценивает безопасность нагрузок и не заменяет консультацию специалиста.
      </p>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => update((d) => ({ ...d, settings: { ...d.settings, doctorAck: true } }))}
      >
        Понятно
      </button>
    </Notice>
  );
}

export function SymptomsNotice() {
  return (
    <Notice tone="danger">
      <strong>Если появились необычные симптомы или самочувствие ухудшилось</strong>
      <p>
        Остановите тренировку и обратитесь за медицинской помощью. При одышке, боли в груди, отёках, сыпи, сильной слабости или
        головокружении звоните 103 / 112.
      </p>
    </Notice>
  );
}

export const DISCLAIMER =
  'Все цифры в приложении — ориентиры для самоконтроля, а не медицинские предписания. Приложение не ставит диагнозы и не заменяет врача.';
