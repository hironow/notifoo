import { useNavigate } from "react-router";
import styles from "./Header.module.css";

interface HeaderProps {
  title: string;
  enableBack?: boolean;
}

export function Header({ title, enableBack = false }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.backBlock}>
        {enableBack && (
          <wa-button size="small" onClick={() => navigate("/")}>
            Back
          </wa-button>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
    </header>
  );
}
