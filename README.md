# Test it

```
npm run build && sam local start-api
curl http://127.0.0.1:3000/OW_826a9d88-0bbf-42e6-be4c-39831e25f961
```

# Deploy

```
npm run build && npm run package && npm run deploy
npm run build; npm run package; npm run deploy
```

# Reference

Used this project as template: https://github.com/alukach/aws-sam-typescript-boilerplate
