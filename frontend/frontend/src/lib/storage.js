const KEY = "saai_portfolio_v1";

export const loadPortfolio = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const savePortfolio = (items) => {
  localStorage.setItem(KEY, JSON.stringify(items));
};
