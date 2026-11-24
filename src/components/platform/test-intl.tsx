import { NextIntlClientProvider } from "next-intl";
import { render } from "@testing-library/react";
import messages from "../../../messages/en.json";

function English({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Kolkata">
      {children}
    </NextIntlClientProvider>
  );
}

/** Renders with the English messages, as the site does (rerender keeps them). For component tests only. */
export function renderEn(ui: React.ReactElement) {
  return render(ui, { wrapper: English });
}
