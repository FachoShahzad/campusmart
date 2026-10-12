/**
 * js/campus.js — Module 11: campus settings
 * EXAM SEASONS: edit the dates below (format YYYY-MM-DD). While today's date is inside
 * a season, the home feed shows an alert banner and marks Books/Notes as "High demand".
 */
export const EXAM_SEASONS = [
  { name: "Fall Semester Exams",   start: "2026-10-01", end: "2027-01-31" },
  { name: "Spring Semester Exams", start: "2027-05-01", end: "2027-07-15" }
];
export const DEMAND_CATEGORIES = ["Books", "Notes"];

export function currentExamSeason(date = new Date()) {
  const t = date.toISOString().slice(0, 10);
  return EXAM_SEASONS.find(s => t >= s.start && t <= s.end) || null;
}
export const isHighDemand = l => DEMAND_CATEGORIES.includes(l.category);
