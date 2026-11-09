import { useState } from 'react';
import { isIOS, isStandalone, promptInstall, useCanInstall } from '../install';

export function InstallHelp() {
  const canInstall = useCanInstall();
  const [done, setDone] = useState(false);

  if (isStandalone() || done) {
    return <p>✅ Приложение установлено — оно открывается с иконки на главном экране.</p>;
  }

  return (
    <div className="stack">
      {canInstall && (
        <button type="button" className="btn btn-primary btn-big" onClick={async () => setDone(await promptInstall())}>
          📲 Установить приложение
        </button>
      )}
      {isIOS() ? (
        <ol className="steps">
          <li>
            Откройте этот сайт в <strong>Safari</strong>.
          </li>
          <li>
            Нажмите кнопку <strong>«Поделиться»</strong> (квадрат со стрелкой вверх) внизу экрана.
          </li>
          <li>
            Выберите <strong>«На экран „Домой“»</strong> → <strong>«Добавить»</strong>.
          </li>
        </ol>
      ) : (
        !canInstall && (
          <ol className="steps">
            <li>
              Откройте этот сайт в <strong>Chrome</strong>.
            </li>
            <li>
              Нажмите меню <strong>⋮</strong> справа вверху.
            </li>
            <li>
              Выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.
            </li>
          </ol>
        )
      )}
      <p className="muted small">На экране появится иконка «Мой трекер». Приложение открывается на весь экран и работает даже без интернета.</p>
    </div>
  );
}
