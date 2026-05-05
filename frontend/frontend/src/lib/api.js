import axios from "axios";

const BACKEND_URL = const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://stock-advisor-backend-v4og.onrender.com";
export const API = `${BACKEND_URL}/api`;

export const fetchTodayPlan = async (force = false) => {
  const r = await axios.post(`${API}/today-plan`, null, { params: { force } });
  return r.data;
};

export const fetchStockPick = async (symbol) => {
  const r = await axios.post(`${API}/stock-pick`, { symbol: symbol || null });
  return r.data;
};

export const fetchPortfolioAdvice = async (holdings) => {
  const r = await axios.post(`${API}/portfolio-advice`, { holdings });
  return r.data;
};

export const fetchPortfolioPlan = async (risk_appetite = "conservative") => {
  const r = await axios.post(`${API}/portfolio-plan`, {
    capital: 25000,
    risk_appetite,
  });
  return r.data;
};

export const fetchLivePrice = async (symbol) => {
  const r = await axios.get(`${API}/live-price/${symbol}`);
  return r.data;
};
