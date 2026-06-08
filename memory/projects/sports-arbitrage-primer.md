# Sports Arbitrage (Matched Betting) - Beginner Primer

**Category:** Other

## What is it?
Sports arbitrage (or "arbing") is the practice of placing bets on all possible outcomes of an event across different sportsbooks to guarantee a mathematical profit, regardless of who wins the game.

## How is it possible?
Sportsbooks (DraftKings, FanDuel, BetMGM, etc.) set their own odds based on their internal models and where their users are betting. Sometimes, they disagree. 
If DraftKings thinks Team A will win, and FanDuel thinks Team B will win, they will both offer lucrative odds on the opposite team. If the discrepancy is large enough, you can bet on Team A at DraftKings and Team B at FanDuel, and the payouts will be mathematically structured so that the winning ticket pays for the losing ticket PLUS a profit.

## American vs Decimal Odds
Most US sportsbooks use American odds. The bot calculates in Decimal odds, but converts to American for the Telegram alerts to make it easier to read.
- **"+" Odds (e.g., +150):** The amount of profit you make on a $100 bet. (Bet $100, Win $150. Total Payout = $250).
- **"-" Odds (e.g., -150):** The amount you have to bet to make $100 in profit. (Bet $150, Win $100. Total Payout = $250).

## The Dangers & Pitfalls to Understand Before Starting

1. **The "Draw" Trap (3-Way Moneylines)**
   - In sports like Soccer or Hockey, games can end in a Tie (Draw). 
   - If you bet Team A on DraftKings and Team B on FanDuel, and the game ends in a Tie... YOU LOSE BOTH BETS. 
   - *Bot Protection:* The code is currently written to strictly ignore any market that has 3 outcomes. It only analyzes pure 2-way markets (like Tennis, Baseball, or Basketball) where a tie is impossible.

2. **House Rules Discrepancies**
   - Different sportsbooks have different rules for edge cases. 
   - Example: In Tennis, if a player gets injured and retires in the 2nd set, DraftKings might void the bet and refund your money, but FanDuel might grade the retiring player as a "Loss." 
   - If that happens during an Arb, you don't get the guaranteed payout you expected. You must stick to major sports (NBA, NFL, MLB) where the rules are identical across all books, or familiarize yourself with house rules for obscure sports.

3. **Line Movement (The Race Against Time)**
   - Sportsbooks change their odds constantly.
   - If you place Bet 1 on DraftKings, and it takes you 45 seconds to open the FanDuel app to place Bet 2, the odds on FanDuel might have changed. You are now stuck with an un-hedged bet.
   - You must be fast. Have both apps open and ready before hitting "Submit" on either.

4. **"Gubbing" (Account Limits)**
   - Sportsbooks hate arbers. If you only bet on obscure games for weird dollar amounts (e.g., exactly $47.13 instead of $50.00), they will quickly flag your account as an arbitrage bot.
   - *The Penalty:* They won't steal your money, but they will "limit" your account so you can only bet a maximum of $1.00 on any game, rendering the account useless for future arbing.
   - *The Fix:* Always round your bets to the nearest $5 or $10 increment. The math won't be perfectly balanced, but it looks like human behavior and keeps your accounts alive longer.

## Summary
The bot is built and ready in `sports-arb-bot/src/telegram_arb.py`. It requires zero automated execution. When you are ready to learn more or turn it on, we will start with small $10 test bets to get comfortable with the workflow!
