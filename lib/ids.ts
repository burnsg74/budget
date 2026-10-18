export function parseId(value: string | undefined | null): number | null {
  if (!value || !/^[1-9]\d{0,8}$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
