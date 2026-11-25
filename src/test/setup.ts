import '@testing-library/jest-dom';
import { vi } from 'vitest';

// E20c-1: el cifrado de las claves es `server-only` (falla fuera del servidor de Next); en las pruebas no aplica.
vi.mock('server-only', () => ({}));
