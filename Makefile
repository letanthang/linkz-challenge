run:
	mkdir -p logs
	npx prisma db push 2>&1 | tee -a logs/app.log && \
	npx prisma db seed 2>&1 | tee -a logs/app.log && \
	npm run dev 2>&1 | tee -a logs/app.log

test:
	npm test 2>&1 | tee -a logs/app.log
