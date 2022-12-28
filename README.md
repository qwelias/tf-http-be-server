## Terraform HTTP backend server
Zero dependency NodeJS implementation of basic server for [terraform http backend client](https://github.com/hashicorp/terraform/blob/main/internal/backend/remote-state/http/client.go)

### Usage
Use [Dockerfile](./Dockerfile) for deployment

Server `PORT` (`3000`) and `HOST` (`0.0.0.0`) can be changed using env variables

```tf
terraform {
  backend "http" {
    address        = "http://localhost:3000/uniq_state_name"
    lock_address   = "http://localhost:3000/uniq_state_name"
    unlock_address = "http://localhost:3000/uniq_state_name"
  }
}
```

### Notes
All saved states are immutable (unless purged) and saved on file system under `./state/uniq_state_name` where:
- `./number.terraform.tfstate` where number starts from 1 and is incremented on each state save
- `./counter` stores the current number
- `./lockinfo.json` stores current lock info

This is JS, it's single threaded, therefore all critical I/O is done synchronously to avoid locking race-conditions

If you need auth then use this behind an auth server

If you need encryption then use this behind an encrypted network channel
