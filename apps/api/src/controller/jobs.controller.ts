import { Request, Response } from "express";

export const getJobs = async (req: Request, res: Response) => {
  try {
    const { jobs } = req.body;
    res.status(200).json({ jobs });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

export const addJob = async (req: Request, res: Response) => {
  try {
    console.log(req.body);
    const { jobData } = req.body;

    res.status(201).json({ message: "Job added successfully!", jobData });
  } catch (error) {
    res.status(500).json({ error: "Failed to add job" });
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = {};
    res.status(200).json({ job });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { jobData } = req.body;

    res
      .status(200)
      .json({ message: "Job updated successfully!", jobId, jobData });
  } catch (error) {
    res.status(500).json({ error: "Failed to update job" });
  }
};
