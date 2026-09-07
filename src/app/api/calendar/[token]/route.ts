import { buildCalendar } from "@/lib/calendar/ics";
import { listScheduleSlots, listTasks } from "@/lib/queries/study";
import { CALENDAR_TOKEN_KEY, findUserIdByToken } from "@/lib/queries/settings";

/**
 * Календарная лента: `/api/calendar/<токен>.ics`
 *
 * На этот адрес подписываются Apple Calendar («Файл → Новая подписка на
 * календарь»), Google Calendar («Другие календари → По URL») и Outlook.
 * Клиент периодически перечитывает ленту сам — вебхуков и OAuth не требуется.
 *
 * Защита — только неизвестность токена: авторизации в приложении нет, а лента
 * должна открываться сервером Google без всяких заголовков. Токен на 128 бит
 * перебором не находится; если он всё же утёк, его меняют в разделе настроек,
 * и все прежние подписки перестают работать.
 */

// Лента должна отдавать актуальные данные при каждом запросе.
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params;

  // Некоторые клиенты определяют формат по расширению — принимаем оба вида.
  const token = rawToken.replace(/\.ics$/i, "");

  // 404, а не 403: неверный токен не должен подтверждать, что лента существует.
  const userId = await findUserIdByToken(CALENDAR_TOKEN_KEY, token);
  if (!userId) {
    return new Response("Not found", { status: 404 });
  }

  const [slots, tasks] = await Promise.all([listScheduleSlots(userId), listTasks(userId)]);
  const body = buildCalendar({ slots, tasks });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="life-hub.ics"',
      // Кэшировать нечего: подписка и так ходит по расписанию клиента, а
      // промежуточный кэш заморозил бы правки расписания на неопределённый срок.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
