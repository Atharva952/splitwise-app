1.make splitwise expense tracker where group of pepole can split there expenses , can create a groupe like for trip where each can add expense who did the payment last night for dinner shemach( expense: payer, amount, currency 
(INR default), description, date, and split mode) , user schema (username , email , password ) ,Server-side validation 
on every field. Splits must sum to the total reject otherwise. make this in  backend : nodeJS , express , mongoDB  , frontend: reactJS


2.i made expense tracker where users can create g grope can they can split there expense did on trip , now i want add the AI feature where user can write a text like : "I paid 2400 
for dinner last night, split equally between me, Aman, and Priya ,Bill from Trupti was 
1850, Aman and I shared, he didn't have desserts so reduce his share by 150, and the 
app must parse this into a valid expense (payer, amount, members, split) and pre-fill the 
form. The user reviews and confirms before saving.   Bill text parsing — A user can paste raw bill text (a restaurant bill, a receipt) and the app 
extracts line items + total, then prompts the user to assign items to people. End-to-end: 
paste → parsed structure → assignable UI → saved as expense with custom splits . how cloud i add this feature in my application?  for this im useing google AI studio api key


3.build bill image upload + OCR

4.use tailwindcss and style UI like morden expense tracker its should look good