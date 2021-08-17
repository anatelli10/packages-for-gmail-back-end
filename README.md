<p align="center">

  <h3 align="center">
    <a href="https://packagesforgmail.com/">[WIP] Packages for Gmail (Back-End)</a>
  </h3>

</p>

<!-- TABLE OF CONTENTS -->
<details open="open">
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about">About</a>
      <ul>
        <li><a href="#code-examples">Code Examples</a></li>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li><a href="#acknowledgements">Acknowledgements</a></li>
  </ol>
</details>

<!-- ABOUT -->

## About

Work in progress. Express server backend for the [Packages for Gmail](https://github.com/anatelli10/packages-for-gmail) Chrome Extension. Authenticates users with Google OAuth. Queries Gmail API for email messages then detects tracking numbers in them using [TS Tracking Number](https://github.com/rjbrooksjr/ts-tracking-number) and a little bit of magic. Built on top of [Express MongoDB example from BezKoder](https://github.com/bezkoder/jwt-refresh-token-node-js-mongodb).

#### Code Examples
-   [accounts/account-service.js](https://github.com/anatelli10/packages-for-gmail-back-end/blob/main/accounts/account.service.js)
-   [\_helpers/tracking](https://github.com/anatelli10/packages-for-gmail-back-end/tree/main/_helpers/tracking)

#### Built With

-   [Node.js](https://nodejs.org/en/)
-   [Express](https://expressjs.com/)
-   [Google APIs (Gmail, OAuth)](https://github.com/googleapis/google-api-nodejs-client)

<!-- ACKNOWLEDGEMENTS -->

## Acknowledgements

-   [BezKoder Express MongoDB Example](https://github.com/bezkoder/jwt-refresh-token-node-js-mongodb)
-   [TS Tracking Number](https://github.com/rjbrooksjr/ts-tracking-number)
-   [Google OAuth Tutorial](https://github.com/tomanagle/google-oauth-tutorial)
-   [date-fns](https://date-fns.org/)
-   [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)
-   [got](https://github.com/sindresorhus/got)
-   [node-cache](https://github.com/node-cache/node-cache)
-   [Best-README-Template](https://github.com/othneildrew/Best-README-Template)
