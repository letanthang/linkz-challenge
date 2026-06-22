package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"

	apptentity "keyloop/internal/domain/appointment/entity"
	apptuc "keyloop/internal/domain/appointment/usecase"
	availentity "keyloop/internal/domain/availability/entity"
	availuc "keyloop/internal/domain/availability/usecase"
	catalogentity "keyloop/internal/domain/catalog/entity"
	cataloguc "keyloop/internal/domain/catalog/usecase"
	"keyloop/internal/domain/config"
	dealershipentity "keyloop/internal/domain/dealership/entity"
	dealershipuc "keyloop/internal/domain/dealership/usecase"
	vehicleentity "keyloop/internal/domain/vehicle/entity"
	vehicleuc "keyloop/internal/domain/vehicle/usecase"
	"keyloop/internal/infrastructure/eventbus"
	"keyloop/internal/infrastructure/handler"
	"keyloop/internal/infrastructure/persistence"
)

func main() {
	db := mustConnectDB()
	mustMigrate(db)

	dispatcher := eventbus.NewInProcessDispatcher()
	dispatcher.Register("appointment.confirmed", eventbus.LogHandler)

	appointmentRepo := persistence.NewAppointmentRepository(db)
	availabilityRepo := persistence.NewAvailabilityRepository(db)
	catalogRepo := persistence.NewCatalogRepository(db)
	dealershipRepo := persistence.NewDealershipRepository(db)
	vehicleRepo := persistence.NewVehicleRepository(db)
	txManager := persistence.NewTxManager(db)

	bookUsecase := apptuc.NewBookAppointmentUsecase(
		appointmentRepo, availabilityRepo, catalogRepo, dealershipRepo, vehicleRepo, dispatcher,
	).WithTxManager(txManager)

	dealershipUsecase := dealershipuc.NewDealershipUsecase(dealershipRepo, catalogRepo)
	catalogUsecase := cataloguc.NewCatalogUsecase(catalogRepo)
	vehicleUsecase := vehicleuc.NewVehicleUsecase(vehicleRepo)
	availabilityUsecase := availuc.NewAvailabilityUsecase(availabilityRepo, catalogRepo)

	r := gin.Default()

	healthHandler := func(c *gin.Context) { c.String(http.StatusOK, "ok") }
	r.GET("/healthz", healthHandler)

	v1 := r.Group("/api/v1")
	v1.GET("/healthz", healthHandler)
	handler.NewBookingHandler(bookUsecase).RegisterRoutes(v1)
	handler.NewDealershipHandler(dealershipUsecase).RegisterRoutes(v1)
	handler.NewCatalogHandler(catalogUsecase).RegisterRoutes(v1)
	handler.NewVehicleHandler(vehicleUsecase).RegisterRoutes(v1)
	handler.NewAvailabilityHandler(availabilityUsecase).RegisterRoutes(v1)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

func mustConnectDB() *gorm.DB {
	cfg := config.ParseFromEnv()
	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	return db
}

func mustMigrate(db *gorm.DB) {
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
		log.Fatalf("migration failed: %v", err)
	}
}
