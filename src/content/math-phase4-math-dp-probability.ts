import { Topic } from './types';

const mathDPProbability: Topic = {
  id: 'math-dp-probability',
  subjectId: 'math',
  title: 'Probability Distributions',
  description: 'Discrete random variables, expected value and variance, binomial distribution, normal distribution, standardisation, inverse normal, linear combinations, sample mean distributions, and hypothesis testing.',
  ibLevel: 'DP',
  notes: [
    {
      id: 'prb-n1',
      heading: 'Discrete Random Variables',
      body: `A discrete random variable (DRV) counts outcomes that can only take certain separated values. Think of it as a numerical label we attach to each possible result of a random experiment.

📌 Definition
A discrete random variable $X$ takes countable values $x$ with probabilities $P(X = x)$ such that:
• Each probability is non-negative: $P(X = x) \\geq 0$
• All probabilities sum to 1: $\\sum P(X = x) = 1$

🔑 Expected Value (Mean)
$$E(X) = \\sum x \\cdot P(X = x)$$

This is the long-run average outcome. It does not need to be an actual value $X$ can take.

🔑 Variance and Standard Deviation
$$Var(X) = E(X^2) - [E(X)]^2$$
where
$$E(X^2) = \\sum x^2 \\cdot P(X = x)$$

Then
$$SD(X) = \\sqrt{Var(X)}$$

💡 Worked Example — Finding $E(X)$ and $Var(X)$
The probability distribution of $X$ is:

    $x$      | 1   | 2   | 3   | 4
    $P(X=x)$ | 0.1 | 0.3 | 0.4 | 0.2

  Step 1: Calculate $E(X)$
    $E(X) = 1(0.1) + 2(0.3) + 3(0.4) + 4(0.2)$
    $E(X) = 0.1 + 0.6 + 1.2 + 0.8 = 2.7$

  Step 2: Calculate $E(X^2)$
    $E(X^2) = 1^2(0.1) + 2^2(0.3) + 3^2(0.4) + 4^2(0.2)$
    $E(X^2) = 0.1 + 1.2 + 3.6 + 3.2 = 8.1$

  Step 3: Calculate $Var(X)$
    $Var(X) = 8.1 - (2.7)^2 = 8.1 - 7.29 = 0.81$

  Step 4: Calculate $SD(X)$
    $SD(X) = \\sqrt{0.81} = 0.9$

🔑 Linear Transformation Rules
For constants $a$ and $b$:
$$E(aX + b) = a \\cdot E(X) + b$$
$$Var(aX + b) = a^2 \\cdot Var(X)$$

Notice: adding $b$ shifts the mean but does not affect spread. Multiplying by $a$ scales both mean and standard deviation by $a$, and variance by $a^2$.

📎 Key Points to Remember
• Always check that $\\sum P(X = x) = 1$ before calculating expectations
• A fair game has expected gain equal to zero
• $E(X)$ is a weighted average — the most likely value is the mode, not necessarily the mean

⚠️ Common Mistake
Using $E(X)^2$ instead of $E(X^2)$ in the variance formula. $E(X^2)$ means square first, then multiply by probability and sum. $[E(X)]^2$ means find the mean first, then square it. These are different!`,
    },
    {
      id: 'prb-n2',
      heading: 'Binomial Distribution',
      body: `The binomial distribution models the number of successes in a fixed number of identical, independent trials.

📌 Definition
A discrete random variable $X$ follows a binomial distribution, written $X \\sim B(n, p)$, if these four conditions hold:

1. Fixed number of trials ($n$)
2. Independent trials
3. Same probability of success ($p$) each trial
4. Two outcomes per trial — success or failure

🔑 Probability Mass Function
$$P(X = r) = \\binom{n}{r} p^r (1 - p)^{n-r}$$

where
$$\\binom{n}{r} = \\frac{n!}{r!(n - r)!}$$

🔑 Mean and Variance
$$E(X) = np$$
$$Var(X) = np(1 - p)$$

💡 Worked Example — Setting Up a Binomial Model
A factory produces light bulbs. It is known that 8% of bulbs are defective. A quality inspector tests a random sample of 20 bulbs.

  Step 1: Identify the random variable
    Let $X =$ number of defective bulbs in the sample

  Step 2: Check the conditions
    • Fixed $n = 20$
    • Independent (sample is random and population is large)
    • Two outcomes: defective or not defective
    • Constant $p = 0.08$

  Step 3: State the distribution
    $X \\sim B(20, 0.08)$

  Step 4: Calculate expected number of defectives
    $E(X) = 20 \\times 0.08 = 1.6$

💡 Worked Example — Calculating Binomial Probabilities
For $X \\sim B(10, 0.4)$, find:

  (a) $P(X = 3)$
    Use binompdf on GDC with $n = 10$, $p = 0.4$, $x = 3$
    $P(X = 3) \\approx 0.215$

  (b) $P(X \\leq 3)$
    Use binomcdf on GDC with $n = 10$, $p = 0.4$, $x = 3$
    $P(X \\leq 3) \\approx 0.382$

  (c) $P(X \\geq 5)$
    $P(X \\geq 5) = 1 - P(X \\leq 4)$
    Use binomcdf on GDC with $x = 4$
    $P(X \\geq 5) = 1 - 0.633 = 0.367$

📎 Key Points to Remember
• binompdf gives $P(X = r)$ — probability of exactly $r$ successes
• binomcdf gives $P(X \\leq r)$ — cumulative probability up to $r$
• For strict inequalities with discrete distributions, adjust by 1:
  • $P(X < 5) = P(X \\leq 4)$
  • $P(X > 5) = 1 - P(X \\leq 5)$
  • $P(3 \\leq X \\leq 7) = P(X \\leq 7) - P(X \\leq 2)$

⚠️ Common Mistake
Forgetting that the binomial distribution is discrete. $P(X < 5)$ is NOT the same as $P(X \\leq 5)$ — it equals $P(X \\leq 4)$. Always think about which integer values are included.`,
    },
    {
      id: 'prb-n3',
      heading: 'Normal Distribution',
      body: `The normal distribution is the most important continuous probability distribution in statistics. It describes many natural phenomena where values cluster around a central mean.

📌 Definition
A continuous random variable $X$ follows a normal distribution, written $X \\sim N(\\mu, \\sigma^2)$, if its probability density function is a symmetric bell-shaped curve where:

    $\\mu$ = mean (centre of the distribution)
    $\\sigma^2$ = variance
    $\\sigma$ = standard deviation

🔑 The 68-95-99.7 Rule
For any normal distribution:
• Approximately $68\\%$ of data lies within $\\mu \\pm \\sigma$
• Approximately $95\\%$ of data lies within $\\mu \\pm 2\\sigma$
• Approximately $99.7\\%$ of data lies within $\\mu \\pm 3\\sigma$

💡 Worked Example — Using the Empirical Rule
Test scores are normally distributed with $\\mu = 72$ and $\\sigma = 8$.

  (a) What percentage of scores lie between 64 and 80?
    $64 = 72 - 8 = \\mu - \\sigma$
    $80 = 72 + 8 = \\mu + \\sigma$
    Answer: approximately $68\\%$

  (b) What percentage of scores are above 88?
    $88 = 72 + 16 = \\mu + 2\\sigma$
    $95\\%$ lie within $\\mu \\pm 2\\sigma$, so $5\\%$ lie in the two tails
    Answer: approximately $2.5\\%$

🔑 Standardisation (Z-Scores)
Any normal variable can be converted to the standard normal $Z \\sim N(0, 1)$ using:

    $$Z = \\frac{X - \\mu}{\\sigma}$$

This lets you compare values from different normal distributions.

💡 Worked Example — Standardisation
For $X \\sim N(50, 25)$, find $P(X < 58)$.

  Step 1: Identify $\\mu$ and $\\sigma$
    $\\mu = 50$,  $\\sigma = \\sqrt{25} = 5$

  Step 2: Standardise
    $Z = \\frac{58 - 50}{5} = 1.6$

  Step 3: Find probability
    $P(X < 58) = P(Z < 1.6) \\approx 0.945$

🔑 Using Your GDC
• normalcdf(lower, upper, $\\mu$, $\\sigma$) — finds $P(a < X < b)$
• invNorm(area, $\\mu$, $\\sigma$) — finds the value $k$ such that $P(X < k) = $ area

💡 Worked Example — Inverse Normal
For $X \\sim N(100, 225)$, find $k$ such that $P(X < k) = 0.9$.

  Step 1: Identify parameters
    $\\mu = 100$,  $\\sigma = \\sqrt{225} = 15$

  Step 2: Use invNorm on GDC
    invNorm(0.9, 100, 15) $\\approx 119.2$

📎 Key Points to Remember
• For continuous distributions, $P(X = k) = 0$ for any specific value $k$
• It does not matter whether you use strict ($<$) or weak ($\\leq$) inequalities
• For $P(X > a)$, use a very large upper bound (like $10^{99}$) or use $1 - P(X < a)$
• Always sketch the bell curve and shade the region you want

⚠️ Common Mistake
Entering variance instead of standard deviation into the GDC. The notation $X \\sim N(\\mu, \\sigma^2)$ gives variance as the second parameter, but your calculator needs $\\sigma$ (the standard deviation). If $\\sigma^2 = 25$, enter $\\sigma = 5$.`,
    },
    {
      id: 'prb-n4',
      heading: 't-Distribution and Hypothesis Testing (AI HL)',
      body: `When the population standard deviation is unknown and the sample size is small, we use the t-distribution instead of the normal distribution for inference about the mean.

📌 The t-Distribution
The t-distribution is similar to the standard normal but has heavier tails. It is defined by degrees of freedom:

    $$df = n - 1$$

As $df$ increases, the t-distribution approaches the standard normal $Z \\sim N(0, 1)$.

🔑 One-Sample t-Test Statistic
    $$t = \\frac{\\bar{x} - \\mu_0}{s / \\sqrt{n}}$$

where
    $\\bar{x}$ = sample mean
    $\\mu_0$ = hypothesised population mean under $H_0$
    $s$ = sample standard deviation
    $n$ = sample size

💡 Worked Example — t-Test
A farmer claims his apples weigh 150 g on average. A random sample of 16 apples has mean weight 146 g and standard deviation 8 g. Test at the $5\\%$ significance level.

  Step 1: State hypotheses
    $H_0: \\mu = 150$
    $H_1: \\mu \\neq 150$  (two-tailed test)

  Step 2: Calculate test statistic
    $t = \\frac{146 - 150}{8 / \\sqrt{16}}$
    $t = \\frac{-4}{2} = -2.0$

  Step 3: Find critical value
    $df = 16 - 1 = 15$
    $t_{\\text{crit}}$ for two-tailed test at $5\\%$: $\\pm 2.131$

  Step 4: Compare and conclude
    $|-2.0| = 2.0 < 2.131$
    We do not reject $H_0$.
    There is insufficient evidence at the $5\\%$ level to reject the farmer's claim.

🔑 Chi-Squared Test for Independence (AI)
Used to test whether two categorical variables are independent.

    $$\\chi^2 = \\sum \\frac{(O - E)^2}{E}$$

where
    $O$ = observed frequency
    $E$ = expected frequency $= \\frac{\\text{row total} \\times \\text{column total}}{\\text{grand total}}$

Degrees of freedom:
    $$df = (rows - 1)(columns - 1)$$

💡 Worked Example — Expected Frequency
In a contingency table, a cell has row total 80, column total 60, and grand total 200.

    $$E = \\frac{80 \\times 60}{200} = 24$$

📎 Key Points to Remember
• Use the t-distribution when $\\sigma$ is unknown AND $n < 30$
• For $n > 30$, the normal approximation is usually acceptable
• Reject $H_0$ if $|t| > t_{\\text{crit}}$ OR if p-value $< \\alpha$
• For $\\chi^2$ tests, all expected frequencies should be at least 5 for valid results
• Write conclusions in context — never say "prove" or "disprove"

⚠️ Common Mistake
Confusing the t-test with the z-test. If the population standard deviation $\\sigma$ is given, use $z = \\frac{\\bar{x} - \\mu_0}{\\sigma / \\sqrt{n}}$. If only the sample standard deviation $s$ is available and $n$ is small, use the t-test.`,
    },
    {
      id: 'prb-n5',
      heading: 'Linear Combinations and Sample Mean',
      body: `When we combine random variables by adding, subtracting, or scaling them, we can find the mean and variance of the result using simple rules.

📌 Expected Value of a Linear Combination
For independent random variables $X$ and $Y$, and constants $a$ and $b$:

    $$E(aX \\pm bY) = a \\cdot E(X) \\pm b \\cdot E(Y)$$

📌 Variance of a Linear Combination
For independent $X$ and $Y$:

    $$Var(aX \\pm bY) = a^2 \\cdot Var(X) + b^2 \\cdot Var(Y)$$

Notice: variances ALWAYS add, even when subtracting the variables. This is because $b^2$ is always positive.

💡 Worked Example — Linear Combination
$X$ and $Y$ are independent with $E(X) = 5$, $Var(X) = 3$, $E(Y) = -2$, $Var(Y) = 4$.
Find $E(2X + 5Y)$ and $Var(2X + 5Y)$.

  Step 1: Expected value
    $E(2X + 5Y) = 2(5) + 5(-2) = 10 - 10 = 0$

  Step 2: Variance
    $Var(2X + 5Y) = 2^2(3) + 5^2(4)$
    $Var(2X + 5Y) = 4(3) + 25(4) = 12 + 100 = 112$

🔑 Critical Distinction: $2X$ versus $X + X$
These look similar but behave very differently:

    $2X$ means one observation of $X$, then doubled
    $X + X$ means two independent observations of $X$, then added

Expected values are the same:
    $$E(2X) = 2E(X)$$
    $$E(X + X) = E(X) + E(X) = 2E(X)$$

Variances are different:
    $$Var(2X) = 4 \\cdot Var(X)$$
    $$Var(X + X) = Var(X) + Var(X) = 2 \\cdot Var(X)$$

💡 Worked Example — $2X$ vs $X + X$
Suppose $X$ can only be 0 or 1 with equal probability.

    $2X$ can be 0 or 2
    $X + X$ can be 0, 1, or 2

The second variable has more spread because two independent observations add more variability than scaling one observation.

🔑 Distribution of the Sample Mean
If $X \\sim N(\\mu, \\sigma^2)$, then the sample mean $\\bar{X}$ of $n$ independent observations is also normally distributed:

    $$\\bar{X} \\sim N\\left(\\mu, \\frac{\\sigma^2}{n}\\right)$$

The mean stays the same, but the variance shrinks by a factor of $n$. This means larger samples give more precise estimates of $\\mu$.

💡 Worked Example — Sample Mean Distribution
$X \\sim N(80, 36)$. A random sample of $n = 9$ observations is taken.

  Step 1: Identify population parameters
    $\\mu = 80$,  $\\sigma^2 = 36$

  Step 2: Apply the formula
    $\\bar{X} \\sim N\\left(80, \\frac{36}{9}\\right)$
    $\\bar{X} \\sim N(80, 4)$

  Step 3: Find standard deviation of $\\bar{X}$
    $SD(\\bar{X}) = \\sqrt{4} = 2$

So the sample mean has mean 80 and standard error 2.

📎 Key Points to Remember
• Expected value is linear — it distributes over addition and subtraction
• Variance of a sum equals the sum of variances ONLY for independent variables
• When scaling: $Var(aX) = a^2 \\cdot Var(X)$, not $a \\cdot Var(X)$
• The sample mean is less spread out than individual observations
• For normal populations, $\\bar{X}$ is exactly normal for any $n$

⚠️ Common Mistake
Forgetting to square the constant when finding variance. $Var(3X - 2) = 9 \\cdot Var(X)$, not $3 \\cdot Var(X)$. The $-2$ disappears because adding a constant does not change spread.`,
    },
  ],
  flashcards: [
    { id: 'prb-f1', term: 'Discrete RV', definition: '$X$ takes countable values; $P(X=x)\\geq 0$, $\\sum P=1$.', example: '$X=$ heads in 3 flips: $P(0)=\\frac{1}{8}$, $P(1)=\\frac{3}{8}$, $P(2)=\\frac{3}{8}$, $P(3)=\\frac{1}{8}$.' },
    { id: 'prb-f2', term: 'Expected Value', definition: '$E(X)=\\sum x\\cdot P(X=x)$', example: '$P(X=1)=0.2$, $P(2)=0.5$, $P(3)=0.3 \\to E=1.9$.' },
    { id: 'prb-f3', term: 'Binomial $B(n,p)$', definition: '$P(X=r)=\\binom{n}{r}p^r(1-p)^{n-r}$; $E=np$, $Var=np(1-p)$', example: '$B(10,0.4)$: $E=4$, $Var=2.4$.' },
    { id: 'prb-f4', term: 'Normal $N(\\mu,\\sigma^2)$', definition: 'Bell curve; 68-95-99.7 rule.', example: '$N(100,225)$: $\\mu=100$, $\\sigma=15$.' },
    { id: 'prb-f5', term: 'Standardisation', definition: '$Z=\\frac{X-\\mu}{\\sigma}$ converts to $N(0,1)$.', example: '$N(20,9)$, $X=23 \\to Z=1 \\to P(Z>1)\\approx 0.159$.' },
    { id: 'prb-f6', term: 'Inverse Normal', definition: 'Given $P(X<k)=p$, find $k$ via invNorm($p,\\mu,\\sigma$).', example: '$N(50,16)$, $P(X<k)=0.9 \\to k\\approx 55.1$.' },
    { id: 'prb-f7', term: 'Variance Formula', definition: '$Var(X)=E(X^2)-[E(X)]^2$ where $E(X^2)=\\sum x^2 P(X=x)$.', example: 'If $E(X)=3$ and $E(X^2)=12$, then $Var(X)=12-9=3$.' },
    { id: 'prb-f8', term: 'Linear Combinations', definition: 'For independent $X,Y$: $E(aX\\pm bY)=aE(X)\\pm bE(Y)$; $Var(aX\\pm bY)=a^2Var(X)+b^2Var(Y)$.', example: '$E(X)=5$, $Var(X)=3$, $E(Y)=-2$, $Var(Y)=4 \\to E(2X+5Y)=0$, $Var(2X+5Y)=12+100=112$.' },
    { id: 'prb-f9', term: 'Sample Mean Distribution', definition: 'If $X\\sim N(\\mu,\\sigma^2)$, then $\\bar{X}\\sim N(\\mu,\\sigma^2/n)$.', example: '$X\\sim N(80,36)$, $n=9 \\to \\bar{X}\\sim N(80,4)$, so $SD(\\bar{X})=2$.' },
    { id: 'prb-f10', term: 'Continuous RV Property', definition: 'For any continuous RV, $P(X=k)=0$ for a specific value $k$. We only find probabilities over intervals.', example: 'For $Y\\sim N(20,25)$, $P(Y=20)=0$, but $P(18\\leq Y<27)\\approx 0.579$.' },
  ],
  questions: [
    { id: 'prb-q1', stem: 'Discrete RV: $P(X=1)=0.2$, $P(X=2)=0.5$, $P(X=3)=k$. Find $k$.', choices: ['0.2', '0.3', '0.5', '0.7'], correctIndex: 1, explanation: '$0.2+0.5+k=1 \\to k=0.3$.' },
    { id: 'prb-q2', stem: '$E(X)$ for $P(1)=0.2$, $P(2)=0.5$, $P(3)=0.3$?', choices: ['1.9', '2.0', '2.1', '2.5'], correctIndex: 2, explanation: '$0.2+1.0+0.9=2.1$.' },
    { id: 'prb-q3', stem: '$X\\sim B(8, 0.25)$. $E(X)=?$', choices: ['0.25', '1.5', '2', '3'], correctIndex: 2, explanation: '$np=8\\times0.25=2$.' },
    { id: 'prb-q4', stem: '$X\\sim N(60, 25)$. $P(X<65)\\approx?$', choices: ['0.841', '0.579', '1.000', '0.159'], correctIndex: 0, explanation: '$Z=\\frac{65-60}{5}=1$; $P(Z<1)\\approx 0.841$.' },
    { id: 'prb-q5', stem: 'What % within $\\mu\\pm2\\sigma$?', choices: ['68%', '95%', '99.7%', '50%'], correctIndex: 1, explanation: '$68\\%$ within $\\pm1\\sigma$, $95\\%$ within $\\pm2\\sigma$.' },
    { id: 'prb-q6', stem: '$X\\sim B(n,0.2)$, $E=6$. Find $n$.', choices: ['20', '25', '30', '40'], correctIndex: 2, explanation: '$n\\times0.2=6 \\to n=30$.' },
    { id: 'prb-q7', stem: 'Which scenario CANNOT be modelled by a binomial distribution?', choices: ['Number of heads in 20 fair coin flips', 'Number of sixes when a fair die is rolled 30 times', 'Number of yellow cars in a random sample of 50 from a large car park', 'Number of rolls needed to get the first six'], correctIndex: 3, explanation: 'A binomial distribution requires a fixed number of trials. "Number of rolls until the first six" has no fixed $n$, so it follows a geometric distribution instead. All other options have fixed $n$ and constant $p$.' },
    { id: 'prb-q8', stem: 'A game costs \\$4 to play. The prize $W$ has $P(W=0)=0.5$, $P(W=2)=0.3$, $P(W=10)=0.2$. What is the expected profit?', choices: ['Gain \\$2.60', 'Loss \\$1.40', 'Loss \\$4.00', 'Gain \\$1.40'], correctIndex: 1, explanation: '$E(W)=0\\times0.5+2\\times0.3+10\\times0.2=0+0.6+2.0=\\$2.60$. Expected profit $= E(W)-4.00 = 2.60-4.00 = -\\$1.40$ (a loss of \\$1.40).' },
    { id: 'prb-q9', stem: '$X$ is a random variable with $E(X)=8$ and $Var(X)=5$. What is $Var(3X-2)$?', choices: ['13', '43', '45', '15'], correctIndex: 2, explanation: '$Var(aX+b)=a^2Var(X)$. Here $a=3$, so $Var(3X-2)=9\\times5=45$. The constant $-2$ does not affect variance, and you must square the multiplier $3$, not just multiply by $3$.' },
    { id: 'prb-q10', stem: '$X\\sim N(50, 16)$. A random sample of $n=4$ observations is taken. Which distribution does the sample mean $\\bar{X}$ follow?', choices: ['$N(50, 4)$', '$N(50, 16)$', '$N(12.5, 4)$', '$N(200, 64)$'], correctIndex: 0, explanation: 'If $X\\sim N(\\mu,\\sigma^2)$, then $\\bar{X}\\sim N(\\mu,\\sigma^2/n)$. Here $\\mu=50$, $\\sigma^2=16$, $n=4$, so $\\bar{X}\\sim N(50, 4)$. Distractor B forgets to divide by $n$; C wrongly divides the mean; D multiplies instead of dividing.' },
    { id: 'prb-q11', stem: '$X\\sim B(10, 0.4)$. Which expression gives $P(X \\geq 3)$?', choices: ['$1 - P(X \\leq 2)$', '$1 - P(X \\leq 3)$', '$P(X \\leq 2)$', '$P(X \\leq 3) - P(X \\leq 2)$'], correctIndex: 0, explanation: '$P(X\\geq3)=1-P(X\\leq2)$. For a discrete distribution like binomial, $P(X\\geq3)$ excludes 0, 1, and 2, so we subtract $P(X\\leq2)$. Option B subtracts too much, C gives the wrong tail, and D calculates $P(X=3)$.' },
    { id: 'prb-q12', stem: 'Battery life is normally distributed with mean $12$ hours and standard deviation $2$ hours. The company wants to set a guarantee time such that only $5\\%$ of batteries fail before it. What guarantee should they set?', choices: ['8.7 hours', '9.3 hours', '10.4 hours', '15.3 hours'], correctIndex: 0, explanation: 'Find $k$ where $P(X<k)=0.05$. Using invNorm(0.05,12,2) gives $k\\approx 8.71$ hours. This is below the mean because we want the lower tail. Distractor B uses the wrong tail or z-value; C forgets to multiply $z$ by $\\sigma$; D finds the upper $5\\%$ point.' },
  ],
};

export default mathDPProbability;
