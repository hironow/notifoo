import "react";

type WaBaseProps = React.HTMLAttributes<HTMLElement>;

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "wa-button": WaBaseProps & {
        variant?: string;
        size?: string;
        href?: string;
        slot?: string;
      };
      "wa-card": WaBaseProps & {
        id?: string;
      };
      "wa-icon": WaBaseProps & {
        name?: string;
        slot?: string;
      };
    }
  }
}
