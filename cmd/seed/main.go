package main

import (
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	apptentity "keyloop/internal/domain/appointment/entity"
	availentity "keyloop/internal/domain/availability/entity"
	catalogentity "keyloop/internal/domain/catalog/entity"
	"keyloop/internal/domain/config"
	dealershipentity "keyloop/internal/domain/dealership/entity"
	vehicleentity "keyloop/internal/domain/vehicle/entity"
)

func main() {
	cfg := config.ParseFromEnv()

	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}

	log.Println("running migrations...")
	if err := db.AutoMigrate(
		&dealershipentity.Dealership{},
		&dealershipentity.BusinessHours{},
		&catalogentity.ServiceType{},
		&catalogentity.DealershipService{},
		&availentity.Technician{},
		&availentity.TechnicianSkill{},
		&availentity.ServiceBay{},
		&vehicleentity.Vehicle{},
		&apptentity.Appointment{},
	); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("migrations done")

	seedDir := filepath.Join("db", "seeds")
	matches, err := filepath.Glob(filepath.Join(seedDir, "*.sql"))
	if err != nil {
		log.Fatalf("glob seed files: %v", err)
	}
	if len(matches) == 0 {
		log.Printf("no seed files found in %s", seedDir)
		return
	}
	sort.Strings(matches)

	for _, path := range matches {
		log.Printf("seeding %s...", path)
		content, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("read %s: %v", path, err)
		}
		for _, stmt := range splitStatements(string(content)) {
			if err := db.Exec(stmt).Error; err != nil {
				log.Fatalf("exec statement in %s: %v\nSQL: %s", path, err, stmt)
			}
		}
		log.Printf("done: %s", path)
	}

	log.Println("seed complete")
}

// splitStatements splits a SQL file into individual executable statements,
// skipping blank lines and comment-only blocks.
func splitStatements(sql string) []string {
	var result []string
	for _, chunk := range strings.Split(sql, ";") {
		stmt := strings.TrimSpace(chunk)
		if stmt == "" {
			continue
		}
		// skip chunks that are entirely comments
		onlyComments := true
		for _, line := range strings.Split(stmt, "\n") {
			trimmed := strings.TrimSpace(line)
			if trimmed != "" && !strings.HasPrefix(trimmed, "--") {
				onlyComments = false
				break
			}
		}
		if onlyComments {
			continue
		}
		result = append(result, stmt)
	}
	return result
}
