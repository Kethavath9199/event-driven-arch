-- MySQL dump 10.13  Distrib 5.7.41, for Linux (x86_64)
--
-- Host: 10.5.3.4    Database: transcomm_backend
-- ------------------------------------------------------
-- Server version	8.0.19

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Outbound`
--

DROP TABLE IF EXISTS `Outbound`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Outbound` (
  `id` varchar(191) NOT NULL,
  `hawb_no` varchar(191) NOT NULL,
  `order_id` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`hawb_no`,`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Outbound`
--

LOCK TABLES `Outbound` WRITE;
/*!40000 ALTER TABLE `Outbound` DISABLE KEYS */;
/*!40000 ALTER TABLE `Outbound` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `User` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `firstName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lastName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('viewer','editor','admin','super_admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `locked` tinyint(1) NOT NULL DEFAULT '0',
  `archived` tinyint(1) NOT NULL DEFAULT '0',
  `failedLoginAttempts` int NOT NULL DEFAULT '0',
  `passwordChangeRequired` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `archivedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User`
--

LOCK TABLES `User` WRITE;
/*!40000 ALTER TABLE `User` DISABLE KEYS */;
INSERT INTO `User` VALUES ('2acb0ed6-4d31-4468-b4ef-1e886b1a1784','$2b$10$iYgo0XfjRwwJi8Wkn1yb6.fsscH/eC/TtC/iLxCC5PVuMRfg9XWEe','Soumyojit','Mondal','soumyojit.mondal@dpdhl.com','admin',1,0,5,0,'2022-08-12 14:56:08.922','2023-02-17 12:47:17.419',NULL),('34c69fbd-b97e-41be-be7f-d7e84216e79d','\'$2a$10$4QnRWQE.0zPVrLk6Ub3uY.9Pabgifu2czeRSbaK8CK2zK.kqjPSmy\'','Super','Admin','super@admin.com','super_admin',0,0,0,1,'2023-02-21 08:01:18.591','2023-02-21 08:01:18.591',NULL),('4adfefb6-f482-43cd-944e-036523d3a729','$2b$10$8zz4YXzxwPXKgEnPVuQdmeHtbC.04wMQED.FWpCpyrnE./aWorW9a','bejoy','jacob','bejoy.jacob@dpdhl.com','admin',0,0,0,0,'2023-02-17 12:51:17.094','2023-02-17 12:54:37.077',NULL),('6481e2d2-bbfe-44ec-820f-2ff6ff6fbd03','$2b$10$ifuoHOxsftRE3jI1HzNQzuGZVdtDLJa2QLqBF6xiQDxnQqfMBRMCK','Suraj','Guha','s.guha@dpdhl.com','admin',0,0,0,0,'2023-03-29 08:54:24.543','2023-04-07 05:37:25.202',NULL),('6db4b2cb-cd04-4a3b-ae06-4dc4f12b851f','$2b$10$zeiooYFvbrKdSa9JbBYqF.G8FsdHdKVqs8znv8pPCkQFzmc/UkE9i','soumyojit','mondal','soumyojit.mondal1@dpdhl.com','admin',0,0,0,0,'2023-02-17 12:50:05.363','2023-02-17 12:50:05.363',NULL),('7f583562-035c-43ec-bbf9-87efd416b90c','$2b$10$bBa7IewdxfuNTmTufHZOGeQ7S2Y3mxsGsfZjtdHf5a7vhbFZf0SOy','Jason','Chew','jason.chew1@dhl.com','admin',0,0,0,0,'2022-07-26 20:35:01.627','2023-02-08 12:20:12.268',NULL),('80f75ac3-d100-443f-b44e-941bd11f03fb','$2b$10$HHrwG.miRR0mLw94Wjm7vu/cFj9SX3LKzY3hpgjqWUd2wtVgZR8fK','bless','admin','bless.admin@dhl.com','admin',0,0,0,0,'2022-05-24 09:15:31.322','2022-05-24 09:15:31.322',NULL),('90df0f2b-21dd-454e-bea3-aacd45625613','$2b$10$Spq39DFd0Y9oHrbUF4mt/e2ZZVlxRdRrd/RzAh9laHFBEeoIC7HkC','Tarek','Fadel','Tarek.Fadel@dhl.com','admin',0,0,0,0,'2022-11-14 08:21:48.025','2022-11-14 08:21:48.025',NULL),('95302301-02b5-4b2d-8c76-a3ff364df83f','$2b$10$Bf6UjFZeXRi9RzVYYtDbdew5MRvWKPT6T9/W6eI3z2iU9AraeueUi','Super','Admin','super@admin.com','super_admin',0,0,0,0,'2022-05-23 17:08:12.680','2022-07-26 20:33:28.109',NULL),('d374c53a-b17d-459c-8ad5-642a628cff92','$2b$10$Bf6UjFZeXRi9RzVYYtDbdew5MRvWKPT6T9/W6eI3z2iU9AraeueUi','naveen','kethavath','naveen.kethavath@realvariable.com','viewer',0,0,0,0,'2023-04-13 08:27:32.321','2023-04-20 13:26:27.050',NULL);
/*!40000 ALTER TABLE `User` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2023-04-20 13:51:44
