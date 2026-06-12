import { Topic } from './types';

const mathDpHypothesisTesting: Topic = {
  id: 'math-dp-hypothesis-testing',
  subjectId: 'math',
  title: 'Hypothesis Testing',
  description: "Null and alternative hypotheses, chi-squared tests for independence and goodness of fit, one-sample and two-sample t-tests, paired t-tests, binomial and Poisson hypothesis testing, Type I & II errors, and Spearman's rank correlation.",
  ibLevel: 'DP',
  notes: [
    {
      id: 'math-dp-hypothesis-testing-n1',
      heading: 'The Language of Hypothesis Testing',
      body: `A hypothesis test uses sample data to decide whether there is enough evidence to reject a claim about a population parameter or distribution.

📌 Definition
The null hypothesis $H_0$ is the statement of "no change" or "no effect" that you assume to be true at the start of the test.
The alternative hypothesis $H_1$ is what you suspect might be true instead.

🔑 Key Terms
    Significance level $\\alpha$ — the probability threshold you choose before the test (commonly 1%, 5% or 10%).
    $p$-value — the probability of obtaining a result at least as extreme as the one observed, assuming $H_0$ is true.
    Critical region — the set of test-statistic values that would lead you to reject $H_0$.

💡 Worked Example
A researcher suspects that students at a school sleep fewer than the recommended 8 hours per night. A sample of 50 students yields a mean of 7.4 hours and a $p$-value of 0.018 for a one-tailed test.

  Step 1: Write the hypotheses
    $H_0: \\mu = 8$ hours
    $H_1: \\mu < 8$ hours

  Step 2: Compare the $p$-value with $\\alpha$
    $\\alpha = 0.05$
    $p = 0.018$
    Since $0.018 < 0.05$, we reject $H_0$.

  Step 3: Write the conclusion
    There is sufficient evidence to suggest that students sleep fewer than 8 hours per night on average.

📎 One-Tailed vs Two-Tailed Tests
• One-tailed test — used when you are specifically looking for an increase or a decrease.
• Two-tailed test — used when you are looking for any change, regardless of direction.

📎 How to Word Conclusions
• If $p < \\alpha$: "There is sufficient evidence to suggest that..."
• If $p > \\alpha$: "There is insufficient evidence to suggest that..."
• Never write "accept $H_1$" or "prove $H_0$ is true".

⚠️ Common Mistake
Choosing a one-tailed test after looking at the data. You must decide the direction before collecting the sample, otherwise you artificially inflate the chance of a significant result.`
    },
    {
      id: 'math-dp-hypothesis-testing-n2',
      heading: 'Chi-Squared Tests',
      body: `The chi-squared ($\\chi^2$) test compares observed frequencies with the frequencies you would expect if a certain model were true. It is used either to test for independence between two categorical variables or to check how well a distribution fits a set of data.

📌 Chi-Squared Test for Independence
This test determines whether two categorical variables are associated.
    Expected frequency:     $E = \\frac{(\\text{row total})(\\text{column total})}{\\text{grand total}}$
    Degrees of freedom:     $\\nu = (m-1)(n-1)$    for an $m \\times n$ contingency table
    Test statistic:         $\\chi^2_{\\text{calc}} = \\sum \\frac{(O-E)^2}{E}$

💡 Worked Example — Independence
A survey of 100 students records favourite subject by gender.

            Math   Science   Total
  Male       30      20       50
  Female     25      25       50
  Total      55      45      100

Test at the 5% level whether subject preference is independent of gender.

  Step 1: State the hypotheses
    $H_0$: Subject preference is independent of gender.
    $H_1$: Subject preference is not independent of gender.

  Step 2: Calculate expected frequencies
    $E(\\text{Male}, \\text{Math}) = \\frac{50 \\times 55}{100} = 27.5$
    $E(\\text{Male}, \\text{Science}) = \\frac{50 \\times 45}{100} = 22.5$
    $E(\\text{Female}, \\text{Math}) = \\frac{50 \\times 55}{100} = 27.5$
    $E(\\text{Female}, \\text{Science}) = \\frac{50 \\times 45}{100} = 22.5$

  Step 3: Find degrees of freedom
    $\\nu = (2-1)(2-1) = 1$

  Step 4: Compute $\\chi^2$ and the $p$-value
    $\\chi^2_{\\text{calc}} \\approx 1.01$
    $p\\text{-value} \\approx 0.315$

  Step 5: Decide and conclude
    $0.315 > 0.05$, so we fail to reject $H_0$.
    There is insufficient evidence to suggest that subject preference and gender are associated.

📌 Chi-Squared Goodness of Fit Test
This test checks whether sample data follows a claimed distribution (uniform, binomial, normal or Poisson).
    Degrees of freedom:     $\\nu = k-1$    for $k$ categories
    If you estimate a parameter from the data, subtract 1 extra degree of freedom for each parameter estimated.

💡 Worked Example — Goodness of Fit (Uniform)
A salesman records weekly car sales over six weeks: 15, 17, 11, 21, 14, 12.
Test at the 5% level whether sales are uniformly distributed.

  Step 1: State the hypotheses
    $H_0$: Sales are uniformly distributed.
    $H_1$: Sales are not uniformly distributed.

  Step 2: Calculate expected frequencies
    Total sales = 90
    Expected for each week = $90 \\div 6 = 15$

  Step 3: Find degrees of freedom
    $\\nu = 6-1 = 5$

  Step 4: Compute $\\chi^2$ and the $p$-value
    $$\\chi^2_{\\text{calc}} = \\frac{(15-15)^2}{15} + \\frac{(17-15)^2}{15} + \\frac{(11-15)^2}{15} + \\frac{(21-15)^2}{15} + \\frac{(14-15)^2}{15} + \\frac{(12-15)^2}{15}$$
            $\\approx 4.40$
    $p\\text{-value} \\approx 0.493$

  Step 5: Decide and conclude
    $0.493 > 0.05$, so we fail to reject $H_0$.
    There is insufficient evidence to suggest that sales are not uniform.

📎 Key Points to Remember
• Every expected frequency must be greater than 5. Combine rows or columns if necessary.
• For independence, enter observed data as a matrix on your GDC.
• For goodness of fit, enter observed and expected values as two separate lists.

⚠️ Common Mistake
Forgetting to reduce degrees of freedom when you estimate parameters (e.g. estimating $p$ for a binomial or $\\mu$ for a Poisson distribution from the sample).`
    },
    {
      id: 'math-dp-hypothesis-testing-n3',
      heading: 't-Tests for Means',
      body: `Use a $t$-test when the population variance is unknown and must be estimated from the sample. Your GDC can perform one-sample, two-sample and paired $t$-tests.

📌 One-Sample $t$-Test
Tests a population mean $\\mu$ when $\\sigma^2$ is unknown.
    Test statistic follows a $t$-distribution with $df = n-1$.
    $H_0: \\mu = \\mu_0$

📌 Two-Sample $t$-Test (Pooled)
Compares the means of two independent normal populations.
    You assume the unknown variances are equal.
    $H_0: \\mu_1 = \\mu_2$

📌 Paired $t$-Test
Used when two measurements are taken from the same subject (e.g. before and after).
    Calculate the difference for each pair.
    Perform a one-sample $t$-test on the differences.
    $H_0: \\mu_D = 0$

💡 Worked Example — One-Sample $t$-Test
The IQ of students at a school is normally distributed with mean 126. After playing classical music at lunch, a sample of 15 students has mean IQ 127.1 and sample variance 14.7. Test at 5% whether the mean has changed.

  Step 1: State the hypotheses
    $H_0: \\mu = 126$
    $H_1: \\mu \\neq 126$    (two-tailed)

  Step 2: Find the unbiased estimate of variance
    $\\text{Unbiased estimate} = \\frac{n}{n-1} \\times \\text{sample variance}$
    $\\text{Unbiased estimate} = \\frac{15}{14} \\times 14.7 = 15.75$

  Step 3: Enter data into GDC
    One-sample $t$-test with $\\bar{x} = 127.1$, $s = \\sqrt{15.75}$, $n = 15$
    $p\\text{-value} \\approx 0.301$

  Step 4: Decide and conclude
    $0.301 > 0.05$, so we fail to reject $H_0$.
    There is insufficient evidence to suggest that the mean IQ has changed.

💡 Worked Example — Paired $t$-Test
Nine students take tests in French and Spanish. The scores are:

  Student   1   2   3   4   5   6   7   8   9
  French   61  82  77  80  99  69  75  71  81
  Spanish  74  79  83  66  95  79  82  81  85

Test at the 10% level whether there is a difference in mean scores.

  Step 1: State the hypotheses
    $H_0: \\mu_D = 0$    (no difference)
    $H_1: \\mu_D \\neq 0$    (two-tailed)

  Step 2: Calculate differences (French $-$ Spanish)
    $-13$, 3, $-6$, 14, 4, $-10$, $-7$, $-10$, $-4$

  Step 3: Enter differences into GDC as a single list
    One-sample $t$-test on the differences
    $p\\text{-value} \\approx 0.27$

  Step 4: Decide and conclude
    $0.27 > 0.10$, so we fail to reject $H_0$.
    There is insufficient evidence to suggest a difference in mean scores between the two subjects.

💡 Worked Example — Two-Sample $t$-Test
Puzzle completion times (minutes) are recorded for children and adults.

  Children: 3.1, 2.7, 3.5, 3.1, 2.9, 3.2, 3.0, 2.9
  Adults:   3.1, 3.6, 3.5, 3.6, 2.9, 3.6, 3.4, 3.6, 3.7, 3.0

Test at the 1% level whether children are generally faster.

  Step 1: State the hypotheses
    $H_0: \\mu_1 = \\mu_2$
    $H_1: \\mu_1 < \\mu_2$    (one-tailed)

  Step 2: Choose the test
    Population variances unknown $\\rightarrow$ pooled two-sample $t$-test

  Step 3: Enter data into GDC
    $p\\text{-value} \\approx 0.004$

  Step 4: Decide and conclude
    $0.004 < 0.01$, so we reject $H_0$.
    There is sufficient evidence to suggest that children complete the puzzle faster than adults.

📎 Key Points to Remember
• Always check whether the data is paired before choosing a test.
• For paired data, use the differences — do not ignore the pairing.
• A two-sample test assumes the two groups are independent.

⚠️ Common Mistake
Using a two-sample $t$-test on paired data. This ignores the natural pairing and makes the test less powerful, so you may miss a real effect.`
    },
    {
      id: 'math-dp-hypothesis-testing-n4',
      heading: 'Binomial, Poisson and Type I & II Errors',
      body: `Some hypothesis tests use discrete distributions, and every test carries a risk of reaching the wrong conclusion. Spearman's rank correlation offers a robust way to measure monotonic relationships.

📌 Binomial Hypothesis Test
Used to test whether the proportion of a population with a certain characteristic has increased or decreased.
    $H_0: p = p_0$
    $H_1: p < p_0$  or  $p > p_0$    (one-tailed only in IB DP)
    Test statistic: $x =$ number of successes in $n$ trials
    $p$-value $= P(X \\leq x)$ for $H_1: p < p_0$
    $p$-value $= P(X \\geq x)$ for $H_1: p > p_0$     where $X \\sim B(n, p_0)$

💡 Worked Example — Binomial
A coin is suspected of bias towards heads. In 20 tosses there are 14 heads. Test at the 5% level whether $p > 0.5$.

  Step 1: State the hypotheses
    $H_0: p = 0.5$
    $H_1: p > 0.5$

  Step 2: Identify the test statistic
    $x = 14$

  Step 3: Calculate the $p$-value
    $p$-value $= P(X \\geq 14)$ where $X \\sim B(20, 0.5)$
    $p\\text{-value} \\approx 0.0577$

  Step 4: Decide and conclude
    $0.0577 > 0.05$, so we fail to reject $H_0$.
    There is insufficient evidence to suggest the coin is biased towards heads.

📌 Poisson Hypothesis Test
Used to test whether the mean number of occurrences in a fixed period has changed.
    $H_0: m = m_0$
    $H_1: m < m_0$  or  $m > m_0$    (one-tailed only in IB DP)
    Test statistic: $x =$ observed count
    $p$-value $= P(X \\leq x)$ for $H_1: m < m_0$
    $p$-value $= P(X \\geq x)$ for $H_1: m > m_0$     where $X \\sim \\text{Po}(m_0)$

💡 Worked Example — Poisson
A call centre usually receives 4 calls per hour. One hour only 2 calls are received. Test at the 5% level whether the mean has decreased.

  Step 1: State the hypotheses
    $H_0: m = 4$
    $H_1: m < 4$

  Step 2: Identify the test statistic
    $x = 2$

  Step 3: Calculate the $p$-value
    $p$-value $= P(X \\leq 2)$ where $X \\sim \\text{Po}(4)$
    $p\\text{-value} \\approx 0.238$

  Step 4: Decide and conclude
    $0.238 > 0.05$, so we fail to reject $H_0$.
    There is insufficient evidence to suggest the mean number of calls has decreased.

📌 Type I and Type II Errors
    Type I error — rejecting $H_0$ when it is actually true (false positive).
    Type II error — failing to reject $H_0$ when it is actually false (false negative).
    For continuous distributions:     $P(\\text{Type I}) = \\alpha$
    For discrete distributions:       $P(\\text{Type I}) \\leq \\alpha$
Lowering $\\alpha$ reduces the chance of a Type I error but increases the chance of a Type II error.

📌 Spearman's Rank Correlation Coefficient ($r_s$)
Measures the strength of a monotonic relationship between two variables using ranked data.
    $r_s$ is simply the PMCC calculated on the ranks.
    $r_s = 1$ means the data is strictly increasing.
    $r_s = -1$ means the data is strictly decreasing.
    It is robust to outliers and can be used when the original data is not linear.

💡 Worked Example — Spearman's Rank
Two judges rank five artworks:

  Artwork   A   B   C   D   E
  Judge 1   1   2   3   4   5
  Judge 2   2   1   4   3   5

  Step 1: Enter the ranks as two lists in your GDC
  Step 2: Calculate the PMCC of the ranks
    $r_s \\approx 0.80$
  Step 3: Interpret
    There is a strong positive monotonic correlation between the two judges' rankings.

📎 Key Points to Remember
• Binomial and Poisson hypothesis tests in the IB are one-tailed only.
• For discrete distributions, the probability of a Type I error is at most $\\alpha$, not necessarily equal to it.
• Use Spearman's when the relationship may be monotonic but not linear, or when data is given as ranks.

⚠️ Common Mistake
Using Pearson's PMCC on ranked or clearly non-linear data. Pearson's only measures linear correlation and is sensitive to outliers, whereas Spearman's measures monotonic trends.`
    }
  ],
  flashcards: [
    {
      id: 'math-dp-hypothesis-testing-f1',
      term: 'Null hypothesis ($H_0$)',
      definition: 'The statement of "no change" or "no effect" that is assumed to be true at the start of a test.',
      example: '$H_0: \\mu = 50$ means the population mean is 50.'
    },
    {
      id: 'math-dp-hypothesis-testing-f2',
      term: 'Alternative hypothesis ($H_1$)',
      definition: 'The statement that describes how the population parameter or distribution might have changed.',
      example: '$H_1: \\mu > 50$ (one-tailed) or $H_1: \\mu \\neq 50$ (two-tailed).'
    },
    {
      id: 'math-dp-hypothesis-testing-f3',
      term: '$p$-value',
      definition: 'The probability of obtaining a test statistic at least as extreme as the one observed, assuming $H_0$ is true.',
      example: '$p = 0.03$ means a 3% chance of seeing this result if $H_0$ were true.'
    },
    {
      id: 'math-dp-hypothesis-testing-f4',
      term: 'Chi-squared statistic',
      definition: '$\\chi^2_{\\text{calc}} = \\sum \\frac{(O-E)^2}{E}$. It measures how far observed frequencies differ from expected frequencies.',
      example: 'A large $\\chi^2$ value suggests the variables are not independent.'
    },
    {
      id: 'math-dp-hypothesis-testing-f5',
      term: 'Degrees of freedom',
      definition: 'For independence: $\\nu = (\\text{rows}-1)(\\text{cols}-1)$. For goodness of fit: $\\nu = k-1$ (minus 1 more per estimated parameter).',
      example: 'A $3 \\times 2$ table has $\\nu = (3-1)(2-1) = 2$.'
    },
    {
      id: 'math-dp-hypothesis-testing-f6',
      term: 'One-sample $t$-test',
      definition: 'Tests a population mean when $\\sigma^2$ is unknown, using the $t$-distribution with $df = n-1$.',
      example: 'Testing whether the mean height of a class differs from 170 cm.'
    },
    {
      id: 'math-dp-hypothesis-testing-f7',
      term: 'Paired $t$-test',
      definition: 'Tests the mean difference between two paired sets of data by treating the differences as a single sample.',
      example: 'Comparing students\' scores before and after a revision course.'
    },
    {
      id: 'math-dp-hypothesis-testing-f8',
      term: 'Type I and Type II errors',
      definition: 'Type I: rejecting a true $H_0$ (false positive). Type II: failing to reject a false $H_0$ (false negative).',
      example: 'A medical test saying you are sick when you are healthy is a Type I error.'
    }
  ],
  questions: [
    {
      id: 'math-dp-hypothesis-testing-q1',
      stem: 'In a hypothesis test, the $p$-value is found to be 0.032. The test is carried out at the 5% significance level. What is the correct conclusion?',
      choices: [
        'Accept $H_0$ because $p < 0.05$',
        'Reject $H_1$ because $p < 0.05$',
        'Reject $H_0$ because $p < 0.05$',
        'Accept $H_1$ because $p > 0.05$'
      ],
      correctIndex: 2,
      explanation: 'When the $p$-value is less than the significance level ($0.032 < 0.05$), we reject the null hypothesis $H_0$. We never "accept" $H_1$ definitively — we only say there is sufficient evidence against $H_0$.'
    },
    {
      id: 'math-dp-hypothesis-testing-q2',
      stem: 'Which of the following describes a Type I error?',
      choices: [
        'Failing to reject $H_0$ when $H_0$ is false',
        'Rejecting $H_0$ when $H_0$ is true',
        'Rejecting $H_1$ when $H_1$ is true',
        'Accepting $H_1$ when $H_0$ is false'
      ],
      correctIndex: 1,
      explanation: 'A Type I error is a "false positive" — rejecting the null hypothesis when it is actually true. A Type II error is failing to reject $H_0$ when it is false.'
    },
    {
      id: 'math-dp-hypothesis-testing-q3',
      stem: 'A contingency table for favourite sport vs gender has 3 rows (sports) and 2 columns (gender). What is the number of degrees of freedom for a $\\chi^2$ test for independence?',
      choices: [
        '2',
        '3',
        '4',
        '6'
      ],
      correctIndex: 0,
      explanation: 'For a chi-squared test for independence, $\\nu = (m-1)(n-1) = (3-1)(2-1) = 2 \\times 1 = 2$.'
    },
    {
      id: 'math-dp-hypothesis-testing-q4',
      stem: 'A $\\chi^2$ goodness of fit test is conducted with 5 categories to test whether data follows a uniform distribution. What are the degrees of freedom?',
      choices: [
        '3',
        '4',
        '5',
        '6'
      ],
      correctIndex: 1,
      explanation: 'For a goodness of fit test with $k$ categories, $\\nu = k-1 = 5-1 = 4$. No parameters need estimating for a uniform distribution.'
    },
    {
      id: 'math-dp-hypothesis-testing-q5',
      stem: 'A researcher records the blood pressure of 8 patients before and after taking a new medication. Which test is most appropriate?',
      choices: [
        'Two-sample $z$-test',
        'Two-sample $t$-test',
        'Paired $t$-test',
        '$\\chi^2$ test for independence'
      ],
      correctIndex: 2,
      explanation: 'Since each patient is measured twice (before and after), the data is paired. Calculate the differences and use a paired $t$-test. A two-sample test would ignore the pairing and be less powerful.'
    },
    {
      id: 'math-dp-hypothesis-testing-q6',
      stem: 'In a binomial hypothesis test, $H_0: p = 0.4$ and $H_1: p > 0.4$. In 20 trials there are 12 successes. What is the $p$-value?',
      choices: [
        '$P(X \\leq 12)$',
        '$P(X \\geq 12)$',
        '$P(X = 12)$',
        '$P(X > 12)$'
      ],
      correctIndex: 1,
      explanation: 'For $H_1: p > 0.4$, "at least as extreme" means 12 or more successes. The $p$-value is $P(X \\geq 12)$ where $X \\sim B(20, 0.4)$.'
    },
    {
      id: 'math-dp-hypothesis-testing-q7',
      stem: 'The expected frequency for a cell in a contingency table is calculated as:',
      choices: [
        '$\\frac{(\\text{row total} + \\text{column total})}{\\text{grand total}}$',
        '$\\frac{(\\text{row total})(\\text{column total})}{\\text{grand total}}$',
        '$\\frac{(\\text{row total})(\\text{grand total})}{\\text{column total}}$',
        '$\\frac{\\text{grand total}}{(\\text{row total})(\\text{column total})}$'
      ],
      correctIndex: 1,
      explanation: 'Expected frequency $E = \\frac{(\\text{row total})(\\text{column total})}{\\text{grand total}}$. This assumes the two variables are independent.'
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
      stem: 'A one-sample $t$-test is used instead of a $z$-test when:',
      choices: [
        'The sample size is large',
        'The population variance is unknown',
        'The population is not normally distributed',
        'The significance level is 1%'
      ],
      correctIndex: 1,
      explanation: 'A $t$-test is used when the population variance $\\sigma^2$ is unknown and must be estimated from the sample. If $\\sigma^2$ is known, use a $z$-test. For large $n$, the $t$-distribution approximates the normal distribution.'
    },
    {
      id: 'math-dp-hypothesis-testing-q10',
      stem: 'In a two-sample $t$-test comparing the means of two independent groups, the null hypothesis is:',
      choices: [
        '$\\mu_1 > \\mu_2$',
        '$\\mu_1 = \\mu_2$',
        '$\\mu_1 \\neq \\mu_2$',
        '$\\mu_1 - \\mu_2 = 1$'
      ],
      correctIndex: 1,
      explanation: '$H_0$ always states "no effect" or "no difference": $\\mu_1 = \\mu_2$. $H_1$ would be $\\mu_1 < \\mu_2$, $\\mu_1 > \\mu_2$, or $\\mu_1 \\neq \\mu_2$ depending on the context.'
    }
  ]
};

export default mathDpHypothesisTesting;
