const csvWriter = require('csv-writer');

class CsvWriter {
  static getArrayToCsvHandler = (args: { path: string, headers: { id: string; title: string }[]}) => {
    return csvWriter.createArrayCsvWriter(args);
  }

  static getObjectToCsvHandler = (args: { path: string, header: { id: string; title: string }[]}) => {
    return csvWriter.createObjectCsvWriter(args);
  }
}

export default CsvWriter;
