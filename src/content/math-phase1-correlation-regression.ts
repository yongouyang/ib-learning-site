import { Topic } from './types';

const mathDpCorrelationRegression: Topic = {
  id: 'math-dp-correlation-regression',
  subjectId: 'math',
  title: 'Correlation & Regression',
  description: 'Bivariate data, Pearson and Spearman correlation coefficients, linear and non-linear regression, residuals, coefficient of determination, and hypothesis testing for correlation.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'math-dp-correlation-regression-n1',
      heading: 'Bivariate Data & Scatter Diagrams',
      body: 'Bivariate data consists of paired measurements on two variables. The independent (explanatory) variable is plotted on the x-axis; the dependent (response) variable on the y-axis. A scatter diagram reveals the nature of any relationship. When describing correlation, mention the type (positive, negative, or none) and the strength (strong if points lie close to a line, weak if spread out). A line of best fit drawn by eye should pass through the mean point (x̄, ȳ). Outliers are points that do not follow the general trend and can distort analysis. Crucially, correlation does not imply causation — a third variable or coincidence may explain the pattern.',
    },
    {
      id: 'math-dp-correlation-regression-n2',
      heading: "Pearson's PMCC and Spearman's Rank",
      body: "Pearson's product-moment correlation coefficient (r) measures linear correlation. It ranges from −1 to 1, where r = 1 means perfect positive linear correlation, r = −1 means perfect negative, and r = 0 means none. Calculate r using your GDC; compare |r| to a critical value to assess significance. Pearson's r is affected by outliers. Spearman's rank correlation coefficient (rs) tests for a monotonic relationship by comparing the ranks of data values rather than raw values. It is robust to outliers. If data is linear, it is also monotonic, but exponential growth is monotonic without being linear — making Spearman useful for detecting non-linear trends.",
    },
    {
      id: 'math-dp-correlation-regression-n3',
      heading: 'Linear Regression & Making Predictions',
      body: 'The least squares regression line of y on x has the form y = ax + b, where a is the gradient and b is the y-intercept. It minimises the sum of the squared vertical distances from each point to the line. The line always passes through (x̄, ȳ). Use the equation to predict y from a given x. Predictions made within the range of the original data are called interpolation and are usually reliable, especially when correlation is strong. Predictions outside the data range are called extrapolation and are unreliable because the relationship may change. Never use a regression line to predict x from y unless you have the regression line of x on y.',
    },
    {
      id: 'math-dp-correlation-regression-n4',
      heading: 'Non-linear Regression, Residuals & R²',
      body: 'When data is not linear, non-linear models such as quadratic, cubic, exponential, or power curves can be fitted using a GDC. The residual for each data point is the difference between the observed y-value and the value predicted by the model: residual = y − ŷ. A smaller sum of squared residuals (SSres) indicates a better fit. The coefficient of determination, R², tells you the proportion of variation in the response variable explained by the model. R² = 1 is a perfect fit; values closer to 1 are better. For linear models, R² = r². When comparing models, prefer the one with the higher R², but also consider whether the model type makes sense in context and whether extrapolation is justified.',
    },
  ],
  flashcards: [
    {
      id: 'math-dp-correlation-regression-f1',
      term: 'Bivariate data',
      definition: 'Data collected in pairs on two variables to investigate how one relates to the other.',
      example: 'Height and weight measured for the same group of students.',
    },
    {
      id: 'math-dp-correlation-regression-f2',
      term: "Pearson's PMCC (r)",
      definition: 'A numerical measure of the strength and direction of linear correlation between two variables.',
      example: 'r = 0.85 indicates strong positive linear correlation.',
    },
    {
      id: 'math-dp-correlation-regression-f3',
      term: "Spearman's rank correlation coefficient (rs)",
      definition: 'Measures the strength of a monotonic relationship using the ranks of data values rather than raw values.',
      example: 'Useful when data contains outliers or the relationship is exponential.',
    },
    {
      id: 'math-dp-correlation-regression-f4',
      term: 'Correlation does not imply causation',
      definition: 'A relationship between two variables does not mean one causes the other; a lurking variable may be involved.',
      example: 'Ice cream sales and drowning incidents both increase in summer — heat is the common cause.',
    },
    {
      id: 'math-dp-correlation-regression-f5',
      term: 'Least squares regression line (y on x)',
      definition: 'The straight line y = ax + b that minimises the sum of squared vertical distances from the data points.',
      example: 'If a = 5, y increases by 5 units for every 1-unit increase in x.',
    },
    {
      id: 'math-dp-correlation-regression-f6',
      term: 'Interpolation vs extrapolation',
      definition: 'Interpolation predicts within the data range; extrapolation predicts outside it.',
      example: 'Data spans x = 10 to 50. Predicting at x = 30 is interpolation; at x = 80 is extrapolation.',
    },
    {
      id: 'math-dp-correlation-regression-f7',
      term: 'Residual',
      definition: 'The vertical difference between an observed y-value and the value predicted by the model.',
      example: 'Observed y = 12, predicted ŷ = 9.5 → residual = 2.5.',
    },
    {
      id: 'math-dp-correlation-regression-f8',
      term: 'Coefficient of determination (R²)',
      definition: 'The proportion of variation in the dependent variable explained by the model.',
      example: 'R² = 0.92 means 92% of the variation in y is explained by the model.',
    },
  ],
  questions: [
    {
      id: 'math-dp-correlation-regression-q1',
      stem: 'A scatter diagram shows r = −0.92. Which statement is correct?',
      choices: [
        'Strong positive linear correlation',
        'Strong negative linear correlation',
        'Weak negative linear correlation',
        'No linear correlation',
      ],
      correctIndex: 1,
      explanation: 'The negative sign indicates negative correlation, and |−0.92| is close to 1, so the correlation is strong.',
    },
    {
      id: 'math-dp-correlation-regression-q2',
      stem: 'A data set follows an exponential growth pattern with no outliers. Which correlation coefficient is more appropriate?',
      choices: [
        "Pearson's PMCC because it measures exact linear fit",
        "Spearman's rank because it detects monotonic relationships",
        'Both give the same value since there are no outliers',
        'Neither; exponential data cannot be analysed statistically',
      ],
      correctIndex: 1,
      explanation: "Exponential growth is monotonic (always increasing) but not linear. Spearman's rank tests for monotonicity, while Pearson's measures only linear correlation and would underestimate the relationship.",
    },
    {
      id: 'math-dp-correlation-regression-q3',
      stem: 'The regression line of y on x is y = 4.2x + 7.5. What is the interpretation of 4.2?',
      choices: [
        'When x = 0, y = 4.2',
        'For every 1-unit increase in x, y increases by 4.2',
        'The correlation coefficient is 4.2',
        'The mean of x is 4.2',
      ],
      correctIndex: 1,
      explanation: 'In y = ax + b, the gradient a represents the change in y for each 1-unit increase in x.',
    },
    {
      id: 'math-dp-correlation-regression-q4',
      stem: 'A regression line is fitted using data where x ranges from 5 to 25. Which prediction is least reliable?',
      choices: [
        'x = 10',
        'x = 18',
        'x = 22',
        'x = 40',
      ],
      correctIndex: 3,
      explanation: 'x = 40 is far outside the original data range (5–25), making it extrapolation. The relationship may not hold beyond the observed range.',
    },
    {
      id: 'math-dp-correlation-regression-q5',
      stem: 'For a regression line y = 2.5x + 8, what is the predicted value of y when x = 6?',
      choices: ['15', '23', '30', '48'],
      correctIndex: 1,
      explanation: 'Substitute x = 6: y = 2.5(6) + 8 = 15 + 8 = 23.',
    },
    {
      id: 'math-dp-correlation-regression-q6',
      stem: 'A study finds a strong positive correlation between chocolate consumption per capita and Nobel laureates per capita. What can be concluded?',
      choices: [
        'Eating chocolate causes people to win Nobel prizes',
        'There is a causal relationship between the two variables',
        'A third factor such as wealth may explain both',
        'Nobel prizes cause people to eat more chocolate',
      ],
      correctIndex: 2,
      explanation: 'Correlation does not imply causation. Wealthier countries may both consume more chocolate and invest more in research, creating a spurious correlation.',
    },
    {
      id: 'math-dp-correlation-regression-q7',
      stem: 'A linear model has r = 0.7. What is the coefficient of determination?',
      choices: ['0.7', '0.49', '1.4', '0.3'],
      correctIndex: 1,
      explanation: 'For a linear model, R² = r² = 0.7² = 0.49. This means 49% of the variation in y is explained by the linear relationship with x.',
    },
    {
      id: 'math-dp-correlation-regression-q8',
      stem: 'A data point has y = 15. The regression model predicts ŷ = 12. What is the residual?',
      choices: ['−3', '3', '27', '1.25'],
      correctIndex: 1,
      explanation: 'Residual = observed − predicted = 15 − 12 = 3. A positive residual means the model underestimates the actual value.',
    },
    {
      id: 'math-dp-correlation-regression-q9',
      stem: 'A hypothesis test for correlation uses H₀: ρ = 0 and H₁: ρ ≠ 0 at the 5% level. The p-value is 0.03. What is the conclusion?',
      choices: [
        'Accept H₀; there is no correlation',
        'Reject H₀; there is evidence of linear correlation',
        'Accept H₀; the correlation is perfect',
        'Reject H₀; the correlation is causal',
      ],
      correctIndex: 1,
      explanation: 'Since p-value (0.03) < significance level (0.05), we reject H₀. There is sufficient evidence at the 5% level to suggest a linear correlation exists.',
    },
    {
      id: 'math-dp-correlation-regression-q10',
      stem: 'Which model is most appropriate for data that first increases, reaches a maximum, then decreases?',
      choices: [
        'Exponential model',
        'Linear model',
        'Quadratic model with negative leading coefficient',
        'Cubic model with only positive coefficients',
      ],
      correctIndex: 2,
      explanation: 'A quadratic with a negative leading coefficient produces a downward-opening parabola, which increases to a maximum then decreases — matching the described behaviour.',
    },
  ],
};

export default mathDpCorrelationRegression;
