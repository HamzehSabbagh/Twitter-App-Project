export function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

export function getLatestAllowedBirthDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 18);
  return date;
}

export function isAtLeast18YearsOld(value: string) {
  const parsedDate = parseDateInput(value);

  if (!parsedDate) {
    return false;
  }

  return parsedDate <= getLatestAllowedBirthDate();
}
