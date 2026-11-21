import type { ValidationError } from '../model/manifest';

export type ErrorListProps = { errors: ValidationError[] };

/** Lists each validation error as `path: message`. */
export function ErrorList({ errors }: ErrorListProps) {
  return (
    <ul className="error-list" role="alert">
      {errors.map((e, i) => (
        <li key={`${e.path}-${e.code}-${i}`}>{`${e.path}: ${e.message}`}</li>
      ))}
    </ul>
  );
}
