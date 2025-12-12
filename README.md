# AI Takehome Assessment 

## Background
The in-house legal team at Acme Corp recieves are a large volume of diverse internal legal-related requests from within a company.

:notebook: The legal request could be:
```
Head of Engineering:
  - Hey, we have a new engineer joining, I have an employment contract that I need approval for.

Senior Marketer:
  - We have a marketing campaign ready to launch, I need someone from legal help review it.

A new employee:
  - I am new here, is it a breach of contract if I talk to a competitor?
```
These requests are triaged to a member of the legal team who is responsible for that kind of request e.g sales contracts, employment matters, travel expenses. Occassionally who is responsible for what changes as members are reshuffled and people join and leave the team.

The way requests are triaged can also depend on different properties of the request.  
For example a sales contract review can be assigned to:
* ***John@acme.corp*** if the requestor is from `Australia`, but assigned to
* ***Jane@acme.corp*** if the requestor is from the `United states`.

Combinations of these conditions can be used to triage a request e.g "Location is Australia and Department is Finance".

Traditionally this has all been facilitated through email and members of the legal team at Acme often find themselves having to manually triage requests to the correct team member. As you can imagine this is a painstaking process...


## Scope
> :gem: **Use of AI to help you code and brainstorm is encouraged!**

Build an AI Agent proof of concept that will act as a 'frontdoor' for employees at Acme to send legal requests to. The way this AI Agent triages various types of requests must be configurable. 

Here are some examples of how the AI Agent might behave:
```
Requestor: "I have a Sales contract that I reviewed."
AI Agent: "Where are you based?"
Requestor: "Australia"
AI Agent: "For Sales contract reviews in Australia email xyz@acme.corp" 
```
```
Requestor: "I have a contract that I need approval for."
AI Agent: "Is this a Sales, Employment, or NDA contract?"
Requestor: "It relates to an offer of employment."
AI Agent: "Where are you based?"
Requestor: "United States"
AI Agent: "Please email abc@acme.corp for approval of your contract."
```
We have provided you a lightweight chat app scaffold, feel free to make as many changes to it as you like. Also feel free to to install any additional package or any use any third party providers/APIs. The only constraints are:
- Keep the stack the same i.e Typescript, React frontend, NodeJS express backend. 
- The webapp should have the following routes: 
  - `localhost:5173/chat` the chat interface, where requestor's enter their request. 
  - `localhost:5173/configure` where admins configure how requests are triaged and who they triaged to.  

## Out of Scope
We only want to solve the core problem at hand. Examples of things that are out of scope: 
- Authentication. 
- Deployment. 
- Unit tests. 


## What we are looking for
This assessment is intentionally open ended. We're looking for the following:
- Strong software engineering fundementals - code quality and system design.
- Experience in building AI applications. 'LLM literacy'.
- Product and Design sense i.e the ability to make sensible UX choices. 


## Project scaffold Structure

> :bulb: The current scaffold utilizes OpenAI's GPT-OSS120b model from groq (A fast inference API with limited free access) Click [here](https://groq.com/) to register an account.

A two-part web application consisting of a TypeScript React frontend and a TypeScript Express backend. The chat interface streams responses from OpenAI's model, while a placeholder configuration page is ready for future settings.


- `server` — Express API that proxies streaming requests to OpenAI.
- `client` — React (Vite) single-page application with `/chat` and `/configure` routes.

## Setup

1. **Install dependencies**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. **Environment variables**
   - Copy `.env.example` to `.env` at the project root.
   - Populate the following values:
     - `OPENAI_BASE_URL`: The base url for the openai SDK (Currently points to groq)
     - `OPENAI_API_KEY`: your OpenAI API key.
     - `PORT`: port for the Express server (defaults to `8999`).
     - `VITE_API_BASE_URL`: frontend URL used to reach the backend (defaults to `http://localhost:8999`).

3. **Run the backend**
   ```bash
   cd server
   npm run dev
   ```

   For a production build, run `npm start` to compile the TypeScript sources before launching the server.

4. **Run the frontend**
   ```bash
   cd client
   npm run dev
   ```

   The React app will be available at the URL Vite prints (typically `http://localhost:5173`).


## Lastly
We can't wait to see what you come up with! For any questions feel free to reach out to vince.mu@checkbox.ai
 