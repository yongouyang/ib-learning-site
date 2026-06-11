import { Topic } from './types';

const mathDpHypothesisTesting: Topic = {
  id: 'math-dp-hypothesis-testing',
  subjectId: 'math',
  title: 'Hypothesis Testing',
  description: 'Null and alternative hypotheses, chi-squared tests for independence and goodness of fit, one-sample and two-sample t-tests, paired t-tests, binomial and Poisson hypothesis testing, Type I & II errors, and Spearman\'s rank correlation.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'math-dp-hypothesis-testing-n1',
      heading: 'The Language of Hypothesis Testing',
      body: 'A hypothesis test uses sample data to test a claim about a population parameter or distribution. Begin with the null hypothesis H₀ — the statement of "no change" or "no effect" that you assume to be true. The alternative hypothesis H₁ is what you suspect might be true instead. Before testing, set a significance level α (commonly 1%, 5%, or 10%). Calculate a test statistic from your sample, then find the p-value — the probability of getting a result at least as extreme if H₀ were true. If p < α, reject H₀. A one-tailed test checks for an increase or decrease; a two-tailed test checks for any change. Conclusions must never be definitive: write "there is sufficient evidence to suggest..." or "there is insufficient evidence to suggest...".'
    },
    {
      id: 'math-dp-hypothesis-testing-n2',
      heading: 'Chi-Squared Tests',
      body: 'The χ² test for independence checks whether two categorical variables are associated. Arrange data in a contingency table and calculate expected frequencies using E = (row total × column total) ÷ grand total. The test statistic is χ²_calc = Σ (O−E)² ÷ E. Degrees of freedom ν = (m−1)(n−1) for an m×n table. The χ² goodness of fit test checks whether sample data fits a claimed distribution (uniform, binomial, normal, or Poisson). For k categories, ν = k−1, but subtract an extra 1 for each parameter estimated from the data. All expected frequencies must exceed 5; combine rows or columns if needed. Use your GDC to calculate χ² and the p-value.'
    },
    {
      id: 'math-dp-hypothesis-testing-n3',
      heading: 't-Tests for Means',
      body: 'Use a one-sample t-test to test a population mean μ when the variance σ² is unknown. The test statistic follows a t-distribution with df = n−1. To compare two independent normal populations with unknown but assumed equal variances, use a pooled two-sample t-test with H₀: μ₁ = μ₂. For paired data — such as "before and after" measurements on the same subjects — calculate the differences and perform a one-sample t-test on those differences with H₀: μ_D = 0. All three tests can be one-tailed or two-tailed. Enter summary statistics or raw data into your GDC to obtain the p-value. Reject H₀ if p < α.'
    },
    {
      id: 'math-dp-hypothesis-testing-n4',
      heading: 'Binomial, Poisson and Type I & II Errors',
      body: 'For a binomial proportion test, H₀: p = p₀ versus H₁: p < p₀ or p > p₀ (one-tailed only). The test statistic is the number of successes x; the p-value is P(X ≤ x) or P(X ≥ x) under X~B(n, p₀). For a Poisson mean test, H₀: m = m₀ versus H₁: m < m₀ or m > m₀, using X~Po(m₀). A Type I error occurs when you reject a true H₀ (false positive); for continuous distributions P(Type I) = α, but for discrete distributions it is ≤ α. A Type II error occurs when you fail to reject a false H₀ (false negative). Lowering α reduces Type I error but increases Type II error. Spearman\'s rank correlation coefficient r_s measures monotonic relationships using ranked data; it is robust to outliers unlike Pearson\'s PMCC.'
    }
  ],
  flashcards: [
    {
      id: 'math-dp-hypothesis-testing-f1',
      term: 'Null hypothesis (H₀)',
      definition: 'The statement of "no change" or "no effect" that is assumed to be true at the start of a test.',
      example: 'H₀: μ = 50 means the population mean is 50.'
    },
    {
      id: 'math-dp-hypothesis-testing-f2',
      term: 'Alternative hypothesis (H₁)',
      definition: 'The statement that describes how the population parameter or distribution might have changed.',
      example: 'H₁: μ > 50 (one-tailed) or H₁: μ ≠ 50 (two-tailed).'
    },
    {
      id: 'math-dp-hypothesis-testing-f3',
      term: 'p-value',
      definition: 'The probability of obtaining a test statistic at least as extreme as the one observed, assuming H₀ is true.',
      example: 'p = 0.03 means a 3% chance of seeing this result if H₀ were true.'
    },
    {
      id: 'math-dp-hypothesis-testing-f4',
      term: 'Chi-squared statistic',
      definition: 'χ²_calc = Σ (O−E)² ÷ E. It measures how far observed frequencies differ from expected frequencies.',
      example: 'A large χ² value suggests the variables are not independent.'
    },
    {
      id: 'math-dp-hypothesis-testing-f5',
      term: 'Degrees of freedom',
      definition: 'For independence: ν = (rows−1)(cols−1). For goodness of fit: ν = k−1 (minus 1 more per estimated parameter).',
      example: 'A 3×2 table has ν = (3−1)(2−1) = 2.'
    },
    {
      id: 'math-dp-hypothesis-testing-f6',
      term: 'One-sample t-test',
      definition: 'Tests a population mean when σ² is unknown, using the t-distribution with df = n−1.',
      example: 'Testing whether the mean height of a class differs from 170 cm.'
    },
    {
      id: 'math-dp-hypothesis-testing-f7',
      term: 'Paired t-test',
      definition: 'Tests the mean difference between two paired sets of data by treating the differences as a single sample.',
      example: 'Comparing students\' scores before and after a revision course.'
    },
    {
      id: 'math-dp-hypothesis-testing-f8',
      term: 'Type I and Type II errors',
      definition: 'Type I: rejecting a true H₀ (false positive). Type II: failing to reject a false H₀ (false negative).',
      example: 'A medical test saying you are sick when you are healthy is a Type I error.'
    }
  ],
  questions: [
    {
      id: 'math-dp-hypothesis-testing-q1',
      stem: 'In a hypothesis test, the p-value is found to be 0.032. The test is carried out at the 5% significance level. What is the correct conclusion?',
      choices: [
        'Accept H₀ because p < 0.05',
        'Reject H₁ because p < 0.05',
        'Reject H₀ because p < 0.05',
        'Accept H₁ because p > 0.05'
      ],
      correctIndex: 2,
      explanation: 'When the p-value is less than the significance level (0.032 < 0.05), we reject the null hypothesis H₀. We never "accept" H₁ definitively — we only say there is sufficient evidence against H₀.'
    },
    {
      id: 'math-dp-hypothesis-testing-q2',
      stem: 'Which of the following describes a Type I error?',
      choices: [
        'Failing to reject H₀ when H₀ is false',
        'Rejecting H₀ when H₀ is true',
        'Rejecting H₁ when H₁ is true',
        'Accepting H₁ when H₀ is false'
      ],
      correctIndex: 1,
      explanation: 'A Type I error is a "false positive" — rejecting the null hypothesis when it is actually true. A Type II error is failing to reject H₀ when it is false.'
    },
    {
      id: 'math-dp-hypothesis-testing-q3',
      stem: 'A contingency table for favourite sport vs gender has 3 rows (sports) and 2 columns (gender). What is the number of degrees of freedom for a χ² test for independence?',
      choices: [
        '2',
        '3',
        '4',
        '6'
      ],
      correctIndex: 0,
      explanation: 'For a chi-squared test for independence, ν = (m−1)(n−1) = (3−1)(2−1) = 2×1 = 2.'
    },
    {
      id: 'math-dp-hypothesis-testing-q4',
      stem: 'A χ² goodness of fit test is conducted with 5 categories to test whether data follows a uniform distribution. What are the degrees of freedom?',
      choices: [
        '3',
        '4',
        '5',
        '6'
      ],
      correctIndex: 1,
      explanation: 'For a goodness of fit test with k categories, ν = k−1 = 5−1 = 4. No parameters need estimating for a uniform distribution.'
    },
    {
      id: 'math-dp-hypothesis-testing-q5',
      stem: 'A researcher records the blood pressure of 8 patients before and after taking a new medication. Which test is most appropriate?',
      choices: [
        'Two-sample z-test',
        'Two-sample t-test',
        'Paired t-test',
        'χ² test for independence'
      ],
      correctIndex: 2,
      explanation: 'Since each patient is measured twice (before and after), the data is paired. Calculate the differences and use a paired t-test. A two-sample test would ignore the pairing and be less powerful.'
    },
    {
      id: 'math-dp-hypothesis-testing-q6',
      stem: 'In a binomial hypothesis test, H₀: p = 0.4 and H₁: p > 0.4. In 20 trials there are 12 successes. What is the p-value?',
      choices: [
        'P(X ≤ 12)',
        'P(X ≥ 12)',
        'P(X = 12)',
        'P(X > 12)'
      ],
      correctIndex: 1,
      explanation: 'For H₁: p > 0.4, "at least as extreme" means 12 or more successes. The p-value is P(X ≥ 12) where X~B(20, 0.4).'
    },
    {
      id: 'math-dp-hypothesis-testing-q7',
      stem: 'The expected frequency for a cell in a contingency table is calculated as:',
      choices: [
        '(row total + column total) ÷ grand total',
        '(row total × column total) ÷ grand total',
        '(row total × grand total) ÷ column total',
        'grand total ÷ (row total × column total)'
      ],
      correctIndex: 1,
      explanation: 'Expected frequency E = (row total × column total) ÷ grand total. This assumes the two variables are independent.'
    },
    {
      id: 'math-dp-hypothesis-testing-q8',
      stem: 'Which statement about Spearman\'s rank correlation coefficient is true?',
      choices: [
        'It only measures linear relationships',
        'It requires the original data to be normally distributed',
        'It is robust to outliers and can detect monotonic relationships',
        'It always gives the same value as Pearson\'s PMCC'
      ],
      correctIndex: 2,
      explanation: 'Spearman\'s uses ranked data, so it measures monotonic (consistently increasing or decreasing) relationships and is not greatly affected by outliers. Pearson\'s only measures linear correlation and is sensitive to outliers.'
    },
    {
      id: 'math-dp-hypothesis-testing-q9',
      stem: 'A one-sample t-test is used instead of a z-test when:',
      choices: [
        'The sample size is large',
        'The population variance is unknown',
        'The population is not normally distributed',
        'The significance level is 1%'
      ],
      correctIndex: 1,
      explanation: 'A t-test is used when the population variance σ² is unknown and must be estimated from the sample. If σ² is known, use a z-test. For large n, the t-distribution approximates the normal distribution.'
    },
    {
      id: 'math-dp-hypothesis-testing-q10',
      stem: 'In a two-sample t-test comparing the means of two independent groups, the null hypothesis is:',
      choices: [
        'μ₁ > μ₂',
        'μ₁ = μ₂',
        'μ₁ ≠ μ₂',
        'μ₁ − μ₂ = 1'
      ],
      correctIndex: 1,
      explanation: 'H₀ always states "no effect" or "no difference": μ₁ = μ₂. H₁ would be μ₁ < μ₂, μ₁ > μ₂, or μ₁ ≠ μ₂ depending on the context.'
    }
  ]
};

export default mathDpHypothesisTesting;
