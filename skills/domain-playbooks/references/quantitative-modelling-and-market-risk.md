# Quantitative modelling and market risk

**What to do**

- State the hypothesis before the model. A model that is not a falsifiable claim about a mechanism cannot be evaluated.

**The working stack**

- Pricing models: the Black-Scholes formula and its binomial tree equivalent for European options, the binomial tree for American options, Monte Carlo for paths that have no closed form, and the Greeks computed alongside every price.
- Volatility and correlation: implied volatility surfaces, the GARCH family of generalised autoregressive conditional heteroskedasticity models for modelled volatility, cointegration tests before a pairs strategy, and a factor model for decomposing returns.
- Risk and performance: value at risk and expected shortfall with the confidence level stated, the maximum drawdown, the Sharpe ratio, the Sortino ratio, and the profit factor, each with the sampling frequency and the risk-free rate given.
- Portfolio construction: mean-variance optimisation with its constraints, the Black-Litterman approach that blends a prior with a market view, and risk parity that equalises risk contribution rather than capital.
- Execution: volume-weighted (VWAP), time-weighted (TWAP) and participation-rate algorithms, market impact modelled against participation, and the latency and co-location considerations that matter at high message rates.
- Fit on one sample and validate on another that the model never saw. Use walk-forward or rolling out-of-sample windows rather than a single split, and reserve a final untouched period.
- Model the data pipeline honestly: survivorship bias from delisted instruments, look-ahead bias from restatements, corporate action adjustment, and the timestamp you actually could have had.
- Charge real costs. Spread, commission, market impact proportional to participation rate, borrow cost, and funding.
- Size positions by risk, not by conviction, and define the exit before entry: stop level, invalidation signal, and time stop.
- Report the distribution, not the point estimate. Median, interquartile range, worst drawdown, worst month, and the fraction of losing trades.

**What to watch for**

- Parameter fitting on the evaluation set. If a parameter is tuned on the same data used to report performance, the performance is fiction.
- Multiple testing. Every additional hypothesis tested multiplies the chance of a spurious result; account for it explicitly.
- Liquidity assumptions. A strategy that works on daily bars may be unexecutable intraday, and vice versa.
- Correlation breakdown in a crisis. Portfolio weights computed from calm-period correlation are wrong exactly when they matter.
- Regime dependence. A backtest covering one volatility regime is not evidence across regimes.

**How to verify**

- Out-of-sample results with the sample period stated, plus a walk-forward table showing performance per window rather than one aggregate.
- A parameter sensitivity surface. A strategy whose performance collapses when a parameter moves by ten percent is not a strategy.
- Monte Carlo resampling of the trade sequence to a distribution of outcomes, and a bootstrap of the drawdown path.
- Capacity analysis: performance as a function of notional, with the market impact assumption stated.

