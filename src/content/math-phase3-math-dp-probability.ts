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
A discrete random variable X takes countable values x with probabilities P(X = x) such that:
• Each probability is non-negative: P(X = x) ≥ 0
• All probabilities sum to 1: Σ P(X = x) = 1

🔑 Expected Value (Mean)
    E(X) = Σ x · P(X = x)

This is the long-run average outcome. It does not need to be an actual value X can take.

🔑 Variance and Standard Deviation
    Var(X) = E(X²) − [E(X)]²
where
    E(X²) = Σ x² · P(X = x)

Then
    SD(X) = √Var(X)

💡 Worked Example — Finding E(X) and Var(X)
The probability distribution of X is:

    x      | 1   | 2   | 3   | 4
    P(X=x) | 0.1 | 0.3 | 0.4 | 0.2

  Step 1: Calculate E(X)
    E(X) = 1(0.1) + 2(0.3) + 3(0.4) + 4(0.2)
    E(X) = 0.1 + 0.6 + 1.2 + 0.8 = 2.7

  Step 2: Calculate E(X²)
    E(X²) = 1²(0.1) + 2²(0.3) + 3²(0.4) + 4²(0.2)
    E(X²) = 0.1 + 1.2 + 3.6 + 3.2 = 8.1

  Step 3: Calculate Var(X)
    Var(X) = 8.1 − (2.7)² = 8.1 − 7.29 = 0.81

  Step 4: Calculate SD(X)
    SD(X) = √0.81 = 0.9

🔑 Linear Transformation Rules
For constants a and b:
    E(aX + b) = a·E(X) + b
    Var(aX + b) = a²·Var(X)

Notice: adding b shifts the mean but does not affect spread. Multiplying by a scales both mean and standard deviation by a, and variance by a².

📎 Key Points to Remember
• Always check that Σ P(X = x) = 1 before calculating expectations
• A fair game has expected gain equal to zero
• E(X) is a weighted average — the most likely value is the mode, not necessarily the mean

⚠️ Common Mistake
Using E(X)² instead of E(X²) in the variance formula. E(X²) means square first, then multiply by probability and sum. [E(X)]² means find the mean first, then square it. These are different!`,
    },
    {
      id: 'prb-n2',
      heading: 'Binomial Distribution',
      body: `The binomial distribution models the number of successes in a fixed number of identical, independent trials.

📌 Definition
A discrete random variable X follows a binomial distribution, written X ~ B(n, p), if these four conditions hold:

1. Fixed number of trials (n)
2. Independent trials
3. Same probability of success (p) each trial
4. Two outcomes per trial — success or failure

🔑 Probability Mass Function
    P(X = r) = ⁿCᵣ · pʳ · (1 − p)ⁿ⁻ʳ

where
    ⁿCᵣ = n! / [r!(n − r)!]

🔑 Mean and Variance
    E(X) = np
    Var(X) = np(1 − p)

💡 Worked Example — Setting Up a Binomial Model
A factory produces light bulbs. It is known that 8% of bulbs are defective. A quality inspector tests a random sample of 20 bulbs.

  Step 1: Identify the random variable
    Let X = number of defective bulbs in the sample

  Step 2: Check the conditions
    • Fixed n = 20
    • Independent (sample is random and population is large)
    • Two outcomes: defective or not defective
    • Constant p = 0.08

  Step 3: State the distribution
    X ~ B(20, 0.08)

  Step 4: Calculate expected number of defectives
    E(X) = 20 × 0.08 = 1.6

💡 Worked Example — Calculating Binomial Probabilities
For X ~ B(10, 0.4), find:

  (a) P(X = 3)
    Use binompdf on GDC with n = 10, p = 0.4, x = 3
    P(X = 3) ≈ 0.215

  (b) P(X ≤ 3)
    Use binomcdf on GDC with n = 10, p = 0.4, x = 3
    P(X ≤ 3) ≈ 0.382

  (c) P(X ≥ 5)
    P(X ≥ 5) = 1 − P(X ≤ 4)
    Use binomcdf on GDC with x = 4
    P(X ≥ 5) = 1 − 0.633 = 0.367

📎 Key Points to Remember
• binompdf gives P(X = r) — probability of exactly r successes
• binomcdf gives P(X ≤ r) — cumulative probability up to r
• For strict inequalities with discrete distributions, adjust by 1:
  • P(X < 5) = P(X ≤ 4)
  • P(X > 5) = 1 − P(X ≤ 5)
  • P(3 ≤ X ≤ 7) = P(X ≤ 7) − P(X ≤ 2)

⚠️ Common Mistake
Forgetting that the binomial distribution is discrete. P(X < 5) is NOT the same as P(X ≤ 5) — it equals P(X ≤ 4). Always think about which integer values are included.`,
    },
    {
      id: 'prb-n3',
      heading: 'Normal Distribution',
      body: `The normal distribution is the most important continuous probability distribution in statistics. It describes many natural phenomena where values cluster around a central mean.

📌 Definition
A continuous random variable X follows a normal distribution, written X ~ N(μ, σ²), if its probability density function is a symmetric bell-shaped curve where:

    μ = mean (centre of the distribution)
    σ² = variance
    σ = standard deviation

🔑 The 68-95-99.7 Rule
For any normal distribution:
• Approximately 68% of data lies within μ ± σ
• Approximately 95% of data lies within μ ± 2σ
• Approximately 99.7% of data lies within μ ± 3σ

💡 Worked Example — Using the Empirical Rule
Test scores are normally distributed with μ = 72 and σ = 8.

  (a) What percentage of scores lie between 64 and 80?
    64 = 72 − 8 = μ − σ
    80 = 72 + 8 = μ + σ
    Answer: approximately 68%

  (b) What percentage of scores are above 88?
    88 = 72 + 16 = μ + 2σ
    95% lie within μ ± 2σ, so 5% lie in the two tails
    Answer: approximately 2.5%

🔑 Standardisation (Z-Scores)
Any normal variable can be converted to the standard normal Z ~ N(0, 1) using:

    Z = (X − μ) / σ

This lets you compare values from different normal distributions.

💡 Worked Example — Standardisation
For X ~ N(50, 25), find P(X < 58).

  Step 1: Identify μ and σ
    μ = 50,  σ = √25 = 5

  Step 2: Standardise
    Z = (58 − 50) / 5 = 1.6

  Step 3: Find probability
    P(X < 58) = P(Z < 1.6) ≈ 0.945

🔑 Using Your GDC
• normalcdf(lower, upper, μ, σ) — finds P(a < X < b)
• invNorm(area, μ, σ) — finds the value k such that P(X < k) = area

💡 Worked Example — Inverse Normal
For X ~ N(100, 225), find k such that P(X < k) = 0.9.

  Step 1: Identify parameters
    μ = 100,  σ = √225 = 15

  Step 2: Use invNorm on GDC
    invNorm(0.9, 100, 15) ≈ 119.2

📎 Key Points to Remember
• For continuous distributions, P(X = k) = 0 for any specific value k
• It does not matter whether you use strict (<) or weak (≤) inequalities
• For P(X > a), use a very large upper bound (like 10⁹⁹) or use 1 − P(X < a)
• Always sketch the bell curve and shade the region you want

⚠️ Common Mistake
Entering variance instead of standard deviation into the GDC. The notation X ~ N(μ, σ²) gives variance as the second parameter, but your calculator needs σ (the standard deviation). If σ² = 25, enter σ = 5.`,
    },
    {
      id: 'prb-n4',
      heading: 't-Distribution and Hypothesis Testing (AI HL)',
      body: `When the population standard deviation is unknown and the sample size is small, we use the t-distribution instead of the normal distribution for inference about the mean.

📌 The t-Distribution
The t-distribution is similar to the standard normal but has heavier tails. It is defined by degrees of freedom:

    df = n − 1

As df increases, the t-distribution approaches the standard normal Z ~ N(0, 1).

🔑 One-Sample t-Test Statistic
    t = (x̄ − μ₀) / (s / √n)

where
    x̄ = sample mean
    μ₀ = hypothesised population mean under H₀
    s = sample standard deviation
    n = sample size

💡 Worked Example — t-Test
A farmer claims his apples weigh 150 g on average. A random sample of 16 apples has mean weight 146 g and standard deviation 8 g. Test at the 5% significance level.

  Step 1: State hypotheses
    H₀: μ = 150
    H₁: μ ≠ 150  (two-tailed test)

  Step 2: Calculate test statistic
    t = (146 − 150) / (8 / √16)
    t = −4 / 2 = −2.0

  Step 3: Find critical value
    df = 16 − 1 = 15
    t_crit for two-tailed test at 5%: ±2.131

  Step 4: Compare and conclude
    |−2.0| = 2.0 < 2.131
    We do not reject H₀.
    There is insufficient evidence at the 5% level to reject the farmer's claim.

🔑 Chi-Squared Test for Independence (AI)
Used to test whether two categorical variables are independent.

    χ² = Σ (O − E)² / E

where
    O = observed frequency
    E = expected frequency = (row total × column total) / grand total

Degrees of freedom:
    df = (rows − 1)(columns − 1)

💡 Worked Example — Expected Frequency
In a contingency table, a cell has row total 80, column total 60, and grand total 200.

    E = (80 × 60) / 200 = 24

📎 Key Points to Remember
• Use the t-distribution when σ is unknown AND n < 30
• For n > 30, the normal approximation is usually acceptable
• Reject H₀ if |t| > t_crit OR if p-value < α
• For χ² tests, all expected frequencies should be at least 5 for valid results
• Write conclusions in context — never say "prove" or "disprove"

⚠️ Common Mistake
Confusing the t-test with the z-test. If the population standard deviation σ is given, use z = (x̄ − μ₀) / (σ / √n). If only the sample standard deviation s is available and n is small, use the t-test.`,
    },
    {
      id: 'prb-n5',
      heading: 'Linear Combinations and Sample Mean',
      body: `When we combine random variables by adding, subtracting, or scaling them, we can find the mean and variance of the result using simple rules.

📌 Expected Value of a Linear Combination
For independent random variables X and Y, and constants a and b:

    E(aX ± bY) = a·E(X) ± b·E(Y)

📌 Variance of a Linear Combination
For independent X and Y:

    Var(aX ± bY) = a²·Var(X) + b²·Var(Y)

Notice: variances ALWAYS add, even when subtracting the variables. This is because b² is always positive.

💡 Worked Example — Linear Combination
X and Y are independent with E(X) = 5, Var(X) = 3, E(Y) = −2, Var(Y) = 4.
Find E(2X + 5Y) and Var(2X + 5Y).

  Step 1: Expected value
    E(2X + 5Y) = 2(5) + 5(−2) = 10 − 10 = 0

  Step 2: Variance
    Var(2X + 5Y) = 2²(3) + 5²(4)
    Var(2X + 5Y) = 4(3) + 25(4) = 12 + 100 = 112

🔑 Critical Distinction: 2X versus X + X
These look similar but behave very differently:

    2X means one observation of X, then doubled
    X + X means two independent observations of X, then added

Expected values are the same:
    E(2X) = 2E(X)
    E(X + X) = E(X) + E(X) = 2E(X)

Variances are different:
    Var(2X) = 4·Var(X)
    Var(X + X) = Var(X) + Var(X) = 2·Var(X)

💡 Worked Example — 2X vs X + X
Suppose X can only be 0 or 1 with equal probability.

    2X can be 0 or 2
    X + X can be 0, 1, or 2

The second variable has more spread because two independent observations add more variability than scaling one observation.

🔑 Distribution of the Sample Mean
If X ~ N(μ, σ²), then the sample mean X̄ of n independent observations is also normally distributed:

    X̄ ~ N(μ, σ²/n)

The mean stays the same, but the variance shrinks by a factor of n. This means larger samples give more precise estimates of μ.

💡 Worked Example — Sample Mean Distribution
X ~ N(80, 36). A random sample of n = 9 observations is taken.

  Step 1: Identify population parameters
    μ = 80,  σ² = 36

  Step 2: Apply the formula
    X̄ ~ N(80, 36/9)
    X̄ ~ N(80, 4)

  Step 3: Find standard deviation of X̄
    SD(X̄) = √4 = 2

So the sample mean has mean 80 and standard error 2.

📎 Key Points to Remember
• Expected value is linear — it distributes over addition and subtraction
• Variance of a sum equals the sum of variances ONLY for independent variables
• When scaling: Var(aX) = a²·Var(X), not a·Var(X)
• The sample mean is less spread out than individual observations
• For normal populations, X̄ is exactly normal for any n

⚠️ Common Mistake
Forgetting to square the constant when finding variance. Var(3X − 2) = 9·Var(X), not 3·Var(X). The −2 disappears because adding a constant does not change spread.`,
    },
  ],
  flashcards: [
    { id: 'prb-f1', term: 'Discrete RV', definition: 'X takes countable values; P(X=x)≥0, ΣP=1.', example: 'X=heads in 3 flips: P(0)=1/8, P(1)=3/8, P(2)=3/8, P(3)=1/8.' },
    { id: 'prb-f2', term: 'Expected Value', definition: 'E(X)=Σ x·P(X=x)', example: 'P(X=1)=0.2, P(2)=0.5, P(3)=0.3→E=1.9.' },
    { id: 'prb-f3', term: 'Binomial B(n,p)', definition: 'P(X=r)=ⁿCᵣpʳ(1−p)ⁿ⁻ʳ; E=np, Var=np(1−p)', example: 'B(10,0.4): E=4, Var=2.4.' },
    { id: 'prb-f4', term: 'Normal N(μ,σ²)', definition: 'Bell curve; 68-95-99.7 rule.', example: 'N(100,225): μ=100, σ=15.' },
    { id: 'prb-f5', term: 'Standardisation', definition: 'Z=(X−μ)/σ converts to N(0,1).', example: 'N(20,9), X=23 → Z=1 → P(Z>1)≈0.159.' },
    { id: 'prb-f6', term: 'Inverse Normal', definition: 'Given P(X<k)=p, find k via invNorm(p,μ,σ).', example: 'N(50,16), P(X<k)=0.9→k≈55.1.' },
    { id: 'prb-f7', term: 'Variance Formula', definition: 'Var(X)=E(X²)−[E(X)]² where E(X²)=Σ x²P(X=x).', example: 'If E(X)=3 and E(X²)=12, then Var(X)=12−9=3.' },
    { id: 'prb-f8', term: 'Linear Combinations', definition: 'For independent X,Y: E(aX±bY)=aE(X)±bE(Y); Var(aX±bY)=a²Var(X)+b²Var(Y).', example: 'E(X)=5, Var(X)=3, E(Y)=−2, Var(Y)=4 → E(2X+5Y)=0, Var(2X+5Y)=12+100=112.' },
    { id: 'prb-f9', term: 'Sample Mean Distribution', definition: 'If X~N(μ,σ²), then X̄~N(μ,σ²/n).', example: 'X~N(80,36), n=9 → X̄~N(80,4), so SD(X̄)=2.' },
    { id: 'prb-f10', term: 'Continuous RV Property', definition: 'For any continuous RV, P(X=k)=0 for a specific value k. We only find probabilities over intervals.', example: 'For Y~N(20,25), P(Y=20)=0, but P(18≤Y<27)≈0.579.' },
  ],
  questions: [
    { id: 'prb-q1', stem: 'Discrete RV: P(X=1)=0.2, P(X=2)=0.5, P(X=3)=k. Find k.', choices: ['0.2', '0.3', '0.5', '0.7'], correctIndex: 1, explanation: '0.2+0.5+k=1 → k=0.3.' },
    { id: 'prb-q2', stem: 'E(X) for P(1)=0.2, P(2)=0.5, P(3)=0.3?', choices: ['1.9', '2.0', '2.1', '2.5'], correctIndex: 2, explanation: '0.2+1.0+0.9=2.1.' },
    { id: 'prb-q3', stem: 'X~B(8, 0.25). E(X)=?', choices: ['0.25', '1.5', '2', '3'], correctIndex: 2, explanation: 'np=8×0.25=2.' },
    { id: 'prb-q4', stem: 'X~N(60, 25). P(X<65)≈?', choices: ['0.841', '0.579', '1.000', '0.159'], correctIndex: 0, explanation: 'Z=(65−60)/5=1; P(Z<1)≈0.841.' },
    { id: 'prb-q5', stem: 'What % within μ±2σ?', choices: ['68%', '95%', '99.7%', '50%'], correctIndex: 1, explanation: '68% within ±1σ, 95% within ±2σ.' },
    { id: 'prb-q6', stem: 'X~B(n,0.2), E=6. Find n.', choices: ['20', '25', '30', '40'], correctIndex: 2, explanation: 'n×0.2=6 → n=30.' },
    { id: 'prb-q7', stem: 'Which scenario CANNOT be modelled by a binomial distribution?', choices: ['Number of heads in 20 fair coin flips', 'Number of sixes when a fair die is rolled 30 times', 'Number of yellow cars in a random sample of 50 from a large car park', 'Number of rolls needed to get the first six'], correctIndex: 3, explanation: 'A binomial distribution requires a fixed number of trials. "Number of rolls until the first six" has no fixed n, so it follows a geometric distribution instead. All other options have fixed n and constant p.' },
    { id: 'prb-q8', stem: 'A game costs $4 to play. The prize W has P(W=0)=0.5, P(W=2)=0.3, P(W=10)=0.2. What is the expected profit?', choices: ['Gain $2.60', 'Loss $1.40', 'Loss $4.00', 'Gain $1.40'], correctIndex: 1, explanation: 'E(W)=0×0.5+2×0.3+10×0.2=0+0.6+2.0=$2.60. Expected profit = E(W)−cost = 2.60−4.00 = −$1.40 (a loss of $1.40).' },
    { id: 'prb-q9', stem: 'X is a random variable with E(X)=8 and Var(X)=5. What is Var(3X−2)?', choices: ['13', '43', '45', '15'], correctIndex: 2, explanation: 'Var(aX+b)=a²Var(X). Here a=3, so Var(3X−2)=9×5=45. The constant −2 does not affect variance, and you must square the multiplier 3, not just multiply by 3.' },
    { id: 'prb-q10', stem: 'X~N(50, 16). A random sample of 4 observations is taken. Which distribution does the sample mean X̄ follow?', choices: ['N(50, 4)', 'N(50, 16)', 'N(12.5, 4)', 'N(200, 64)'], correctIndex: 0, explanation: 'If X~N(μ,σ²), then X̄~N(μ,σ²/n). Here μ=50, σ²=16, n=4, so X̄~N(50, 4). Distractor B forgets to divide by n; C wrongly divides the mean; D multiplies instead of dividing.' },
    { id: 'prb-q11', stem: 'X~B(10, 0.4). Which expression gives P(X ≥ 3)?', choices: ['1 − P(X ≤ 2)', '1 − P(X ≤ 3)', 'P(X ≤ 2)', 'P(X ≤ 3) − P(X ≤ 2)'], correctIndex: 0, explanation: 'P(X≥3)=1−P(X≤2). For a discrete distribution like binomial, P(X≥3) excludes 0, 1, and 2, so we subtract P(X≤2). Option B subtracts too much, C gives the wrong tail, and D calculates P(X=3).' },
    { id: 'prb-q12', stem: 'Battery life is normally distributed with mean 12 hours and standard deviation 2 hours. The company wants to set a guarantee time such that only 5% of batteries fail before it. What guarantee should they set?', choices: ['8.7 hours', '9.3 hours', '10.4 hours', '15.3 hours'], correctIndex: 0, explanation: 'Find k where P(X<k)=0.05. Using invNorm(0.05,12,2) gives k≈8.71 hours. This is below the mean because we want the lower tail. Distractor B uses the wrong tail or z-value; C forgets to multiply z by σ; D finds the upper 5% point.' },
  ],
};

export default mathDPProbability;
